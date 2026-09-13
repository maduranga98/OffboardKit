import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

/**
 * Resolved per call, not at module load.
 *
 * `functions.config()` is only populated once the runtime has booted, so
 * reading it into a module-level constant produced `undefined` and every
 * alumni link silently fell back to the hard-coded domain — while the team
 * invite (which resolves it lazily) pointed at the configured one. Deployments
 * that set `app.url` instead of the APP_URL env var were emailing alumni links
 * to the wrong host.
 */
function appUrl(): string {
  const configured =
    process.env.APP_URL || functions.config().app?.url || "https://offboardset.com";
  return configured.replace(/\/+$/, "");
}

/** Firebase Auth stores and compares emails in lower case. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Where the invite email sends the alumni to set their password. */
export const ALUMNI_SETUP_PATH = "/alumni-setup";

/**
 * Makes sure a Firebase Auth account exists for this alumni.
 *
 * Profiles created from a completed offboarding (or imported in bulk) never
 * had an auth account, so `generatePasswordResetLink` used to fail with
 * `auth/user-not-found` and the invite fell back to a bare login link — the
 * alumni then had to type their email and had no password to sign in with.
 *
 * The account is created with an unguessable random password that is never
 * shared; the alumni replaces it through the password-setup link.
 */
export async function ensureAlumniAuthUser(
  email: string,
  displayName?: string
): Promise<string> {
  const normalized = normalizeEmail(email);
  try {
    const existing = await admin.auth().getUserByEmail(normalized);
    return existing.uid;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== "auth/user-not-found") throw err;
  }

  try {
    const created = await admin.auth().createUser({
      email: normalized,
      emailVerified: false,
      password: crypto.randomBytes(32).toString("hex"),
      displayName: displayName || undefined,
    });
    return created.uid;
  } catch (err) {
    // A concurrent invite (or a re-send racing the first) may have created it
    // between the lookup and the create. That is this caller's desired state.
    if ((err as { code?: string })?.code === "auth/email-already-exists") {
      const existing = await admin.auth().getUserByEmail(normalized);
      return existing.uid;
    }
    throw err;
  }
}

/**
 * Builds the in-app password-setup link for an alumni invitation.
 *
 * The Admin SDK's reset link points at Firebase's hosted action handler, which
 * drops the alumni on a generic page and then bounces them to the login form
 * with nothing filled in. We keep the one-time `oobCode` and hand it to our own
 * /alumni-setup page instead, so the email is shown pre-filled (read-only) and
 * the alumni only has to choose a password.
 */
export async function buildAlumniSetupUrl(params: {
  email: string;
  companyId?: string;
  displayName?: string;
}): Promise<{ url: string; authUid: string | null }> {
  const { companyId, displayName } = params;
  const email = normalizeEmail(params.email);
  const base = appUrl();
  const query = new URLSearchParams({ email });
  if (companyId) query.set("companyId", companyId);
  const setupUrl = `${base}${ALUMNI_SETUP_PATH}?${query.toString()}`;

  let authUid: string | null = null;
  try {
    authUid = await ensureAlumniAuthUser(email, displayName);

    const resetLink = await admin.auth().generatePasswordResetLink(email, {
      url: setupUrl,
      handleCodeInApp: false,
    });

    const oobCode = new URL(resetLink).searchParams.get("oobCode");
    if (oobCode) {
      query.set("oobCode", oobCode);
      return { url: `${base}${ALUMNI_SETUP_PATH}?${query.toString()}`, authUid };
    }

    // No oobCode to extract — let Firebase's own handler run; it redirects
    // back to /alumni-setup with the email already in the query string.
    return { url: resetLink, authUid };
  } catch (err) {
    console.error("buildAlumniSetupUrl: falling back to setup page", err);
    // The setup page asks for a fresh link when the code is missing, and the
    // email stays pre-filled either way.
    return { url: setupUrl, authUid };
  }
}
