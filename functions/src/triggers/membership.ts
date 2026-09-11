import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { applyStaffClaims } from "./staffClaims";
import { isEligibleForTrial, newTrialGrant } from "../billing/trial";

/**
 * Tenant membership (users.companyId / users.role) is written ONLY here.
 *
 * Security rules deny every client write to those two fields. Without that,
 * any signed-up user could point their own user document at another company
 * with role "super_admin" and inherit that tenant's entire dataset, because
 * every other rule derives authorization from these values.
 */

/**
 * Attaches the caller to a company they just created in the setup wizard.
 * The company document must name them as ownerUid, and the caller must not
 * already belong to a company.
 */
export const claimCompany = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }
  const { companyId } = (data ?? {}) as { companyId?: unknown };
  if (typeof companyId !== "string" || !companyId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId required");
  }

  const db = admin.firestore();
  const uid = context.auth.uid;
  let trialGranted = false;

  await db.runTransaction(async (tx) => {
    const companyRef = db.collection("companies").doc(companyId);
    const userRef = db.collection("users").doc(uid);
    const [companySnap, userSnap] = await Promise.all([
      tx.get(companyRef),
      tx.get(userRef),
    ]);

    if (!companySnap.exists) {
      throw new functions.https.HttpsError("not-found", "Company not found");
    }
    if (companySnap.data()?.ownerUid !== uid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You do not own this company"
      );
    }
    const existing = userSnap.data()?.companyId;
    if (existing && existing !== companyId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "You already belong to a company"
      );
    }

    tx.set(
      userRef,
      {
        companyId,
        role: "super_admin",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Start the card-free Starter trial. It is granted here, inside the same
    // transaction that establishes ownership, because this is the one server
    // call every signup passes through — and because the client cannot write
    // `plan` itself. `isEligibleForTrial` keeps a retried or replayed claim
    // from extending a window that already started.
    if (isEligibleForTrial(companySnap.data())) {
      tx.update(companyRef, {
        ...newTrialGrant(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      trialGranted = true;
    }
  });

  await applyStaffClaims(uid);
  return { companyId, role: "super_admin", trialGranted };
});

/**
 * Accepts a pending team invite addressed to the caller's verified email and
 * grants the invited role. Replaces the previous client-side flow, which
 * required the invites collection to be world-readable.
 */
export const acceptInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }
  const email = (context.auth.token.email || "").toLowerCase();
  if (!email) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Your account has no email address"
    );
  }

  const db = admin.firestore();
  const uid = context.auth.uid;

  const snap = await db
    .collection("invites")
    .where("email", "==", email)
    .where("status", "==", "pending")
    .get();

  const now = Date.now();
  const valid = snap.docs.find((d) => {
    const expiresAt = d.data().expiresAt as admin.firestore.Timestamp | undefined;
    return !expiresAt || expiresAt.toMillis() > now;
  });

  if (!valid) {
    return { accepted: false };
  }

  const invite = valid.data();
  const ALLOWED_ROLES = ["hr_admin", "it_admin", "manager", "viewer"];
  const role = ALLOWED_ROLES.includes(invite.role) ? invite.role : "viewer";

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (userSnap.data()?.companyId) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "You already belong to a company"
    );
  }

  await db.runTransaction(async (tx) => {
    tx.set(
      userRef,
      {
        companyId: invite.companyId,
        role,
        email,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    tx.update(valid.ref, {
      status: "accepted",
      acceptedBy: uid,
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await applyStaffClaims(uid);
  return { accepted: true, companyId: invite.companyId, role };
});

/**
 * Lets a team admin change a colleague's role within their own company.
 * Cannot target super_admins and cannot move anyone between companies.
 */
export const setMemberRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }
  const { userId, role, isActive } = (data ?? {}) as {
    userId?: unknown;
    role?: unknown;
    isActive?: unknown;
  };
  if (typeof userId !== "string" || !userId) {
    throw new functions.https.HttpsError("invalid-argument", "userId required");
  }

  const db = admin.firestore();
  const callerSnap = await db.collection("users").doc(context.auth.uid).get();
  const caller = callerSnap.data();
  if (
    !caller ||
    !["super_admin", "hr_admin"].includes(caller.role) ||
    !caller.companyId
  ) {
    throw new functions.https.HttpsError("permission-denied", "Not authorized");
  }

  const targetRef = db.collection("users").doc(userId);
  const targetSnap = await targetRef.get();
  const target = targetSnap.data();
  if (!target || target.companyId !== caller.companyId) {
    throw new functions.https.HttpsError("not-found", "Member not found");
  }
  if (target.role === "super_admin" && caller.role !== "super_admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Cannot modify a super admin"
    );
  }

  const update: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const ALLOWED_ROLES = ["hr_admin", "it_admin", "manager", "viewer"];
  if (typeof role === "string") {
    if (!ALLOWED_ROLES.includes(role)) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid role");
    }
    update.role = role;
  }
  if (typeof isActive === "boolean") update.isActive = isActive;

  await targetRef.update(update);
  await applyStaffClaims(userId);
  return { ok: true };
});

/**
 * Detaches a member from the caller's company. Membership removal is a
 * companyId write, so like every other membership change it lives here.
 */
export const removeMember = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }
  const { userId } = (data ?? {}) as { userId?: unknown };
  if (typeof userId !== "string" || !userId) {
    throw new functions.https.HttpsError("invalid-argument", "userId required");
  }
  if (userId === context.auth.uid) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "You cannot remove yourself"
    );
  }

  const db = admin.firestore();
  const callerSnap = await db.collection("users").doc(context.auth.uid).get();
  const caller = callerSnap.data();
  if (
    !caller ||
    !["super_admin", "hr_admin"].includes(caller.role) ||
    !caller.companyId
  ) {
    throw new functions.https.HttpsError("permission-denied", "Not authorized");
  }

  const targetRef = db.collection("users").doc(userId);
  const target = (await targetRef.get()).data();
  if (!target || target.companyId !== caller.companyId) {
    throw new functions.https.HttpsError("not-found", "Member not found");
  }
  if (target.role === "super_admin" && caller.role !== "super_admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Cannot remove a super admin"
    );
  }

  await targetRef.update({
    companyId: "",
    isActive: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await applyStaffClaims(userId);
  return { ok: true };
});
