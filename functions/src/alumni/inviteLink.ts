import * as admin from "firebase-admin";
import * as crypto from "crypto";

const APP_URL = process.env.APP_URL || "https://offboardset.com";

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
  try {
    const existing = await admin.auth().getUserByEmail(email);
    return existing.uid;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== "auth/user-not-found") throw err;
  }

  const created = await admin.auth().createUser({
    email,
    emailVerified: false,
    password: crypto.randomBytes(32).toString("hex"),
    displayName: displayName || undefined,
  });
  return created.uid;
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
  const { email, companyId, displayName } = params;
  const query = new URLSearchParams({ email });
  if (companyId) query.set("companyId", companyId);

  let authUid: string | null = null;
  try {
    authUid = await ensureAlumniAuthUser(email, displayName);

    const resetLink = await admin.auth().generatePasswordResetLink(email, {
      url: `${APP_URL}${ALUMNI_SETUP_PATH}?${query.toString()}`,
    });

    const oobCode = new URL(resetLink).searchParams.get("oobCode");
    if (oobCode) {
      query.set("oobCode", oobCode);
      return { url: `${APP_URL}${ALUMNI_SETUP_PATH}?${query.toString()}`, authUid };
    }

    // No oobCode to extract — let Firebase's own handler run; it redirects
    // back to /alumni-setup with the email already in the query string.
    return { url: resetLink, authUid };
  } catch (err) {
    console.error("buildAlumniSetupUrl: falling back to setup page", err);
    // The setup page asks for a fresh link when the code is missing, and the
    // email stays pre-filled either way.
    return { url: `${APP_URL}${ALUMNI_SETUP_PATH}?${query.toString()}`, authUid };
  }
}
