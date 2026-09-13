import { randomUUID } from "node:crypto";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { assertCompanyActive } from "../billing/access";
import { getSeatUsage, type SeatUsage } from "../billing/planLimits";
import { deliverTeamInvite } from "./sendTeamInvite";

/** Roles a team admin may hand out — super_admin is never invitable. */
const INVITABLE_ROLES = ["hr_admin", "it_admin", "manager"];

/** Roles allowed to invite anyone at all. */
const INVITING_ROLES = ["super_admin", "hr_admin"];

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Creates a team invitation, refusing it when the company's package has no
 * seat left for the person being invited.
 *
 * Invitations used to be written straight from the browser, so the seat count
 * advertised by each package was never enforced anywhere: a Starter company
 * could invite thirty people, all thirty could register, and the product had
 * no answer for what to do with them. The limit belongs here, at the moment
 * the seat is promised — the invitation is simply not sent — rather than at
 * registration or login, where refusing it strands someone with an account
 * they cannot use.
 *
 * firestore.rules now denies client creates on `invites`, so this callable is
 * the only way one comes into existence.
 */
export const createTeamInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }

  const { email: rawEmail, role: rawRole } = (data ?? {}) as {
    email?: unknown;
    role?: unknown;
  };

  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  // Deliberately loose: the address only has to be routable, and the invite
  // is worthless to anyone who cannot receive the email at it.
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new functions.https.HttpsError("invalid-argument", "A valid email is required");
  }

  const role = typeof rawRole === "string" ? rawRole : "";
  if (!INVITABLE_ROLES.includes(role)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `role must be one of ${INVITABLE_ROLES.join(", ")}`
    );
  }

  const db = admin.firestore();

  const callerSnap = await db.collection("users").doc(context.auth.uid).get();
  const caller = callerSnap.data();
  if (!caller?.companyId || !INVITING_ROLES.includes(caller.role)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only an owner or HR admin can invite team members"
    );
  }

  const companyId = caller.companyId as string;

  // Callables bypass firestore.rules, so the subscription lock is re-checked
  // here the same way every other server-side write does it.
  await assertCompanyActive(companyId);

  const companySnap = await db.collection("companies").doc(companyId).get();
  const company = companySnap.data();
  const companyName = (company?.name as string) || "Your company";

  const now = new Date();
  const usage = await getSeatUsage(companyId, company, now);

  // Someone already holding a seat must not be able to take a second one,
  // and re-inviting them would also silently consume one of the checks below.
  const memberSnap = await db
    .collection("users")
    .where("companyId", "==", companyId)
    .where("email", "==", email)
    .limit(1)
    .get();
  if (!memberSnap.empty) {
    throw new functions.https.HttpsError(
      "already-exists",
      "This person is already a team member"
    );
  }

  const existingInviteSnap = await db
    .collection("invites")
    .where("companyId", "==", companyId)
    .where("email", "==", email)
    .where("status", "==", "pending")
    .get();
  const hasLiveInvite = existingInviteSnap.docs.some((doc) => {
    const expiresAt = doc.data().expiresAt as admin.firestore.Timestamp | undefined;
    return !expiresAt || expiresAt.toMillis() > now.getTime();
  });
  if (hasLiveInvite) {
    throw new functions.https.HttpsError(
      "already-exists",
      "This email already has a pending invite"
    );
  }

  if (usage.limit !== null && usage.used >= usage.limit) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      seatLimitMessage(usage),
      { reason: "seat_limit", ...usage }
    );
  }

  // A UUID, not a Firestore auto-id: the id travels in the emailed signup
  // link and previewInvite treats it as the bearer secret (see membership.ts).
  const inviteId = randomUUID();
  const inviteRef = db.collection("invites").doc(inviteId);
  const invite = {
    id: inviteId,
    companyId,
    companyName,
    email,
    role,
    invitedBy: context.auth.uid,
    invitedByName: (caller.displayName as string) || (caller.email as string) || "",
    status: "pending" as const,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(now.getTime() + INVITE_TTL_MS),
  };

  await inviteRef.set(invite);

  try {
    await deliverTeamInvite(inviteId, invite);
  } catch (error) {
    // An invitation nobody received still holds a seat, so it is rolled back
    // rather than left pending — the admin can simply try again.
    console.error("Invite email failed; rolling back invite", inviteId, error);
    await inviteRef.delete().catch((deleteError) =>
      console.error("Failed to roll back invite", inviteId, deleteError)
    );
    throw new functions.https.HttpsError(
      "internal",
      "The invite could not be emailed. Nothing was saved — please try again."
    );
  }

  return {
    inviteId,
    email,
    role,
    seats: {
      ...usage,
      used: usage.used + 1,
      pendingInvites: usage.pendingInvites + 1,
      remaining: usage.remaining === null ? null : Math.max(0, usage.remaining - 1),
    },
  };
});

function seatLimitMessage(usage: SeatUsage): string {
  const seats = usage.limit === 1 ? "1 user" : `${usage.limit} users`;
  const pending =
    usage.pendingInvites > 0
      ? ` (${usage.activeMembers} in use, ${usage.pendingInvites} pending invite${
          usage.pendingInvites === 1 ? "" : "s"
        })`
      : "";
  return (
    `seat-limit-reached: your plan includes ${seats}${pending}. ` +
    "Upgrade your plan, cancel a pending invite, or remove a member to invite someone else."
  );
}
