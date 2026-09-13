import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { applyStaffClaims } from "./staffClaims";
import {
  TRIALABLE_PLANS,
  isEligibleForTrial,
  isTrialActive,
  isTrialablePlan,
  newTrialGrant,
} from "../billing/trial";
import { hasEntitledSubscription } from "../billing/access";

/** Roles allowed to choose or buy a plan — mirrors createCheckoutSession. */
const BILLING_ROLES = ["super_admin", "hr_admin"];

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
 *
 * It starts the card-free trial. `plan` is optional — signup does not ask for
 * a package, so it normally defaults to Starter and the company picks one
 * later from Billing. Passing one is still honoured and validated; either way
 * this subscribes to nothing and cannot charge anyone.
 */
export const claimCompany = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }
  const { companyId, plan } = (data ?? {}) as {
    companyId?: unknown;
    plan?: unknown;
  };
  if (typeof companyId !== "string" || !companyId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId required");
  }
  // An unknown package is refused rather than quietly swapped for the
  // default: the caller asked for something specific and deserves to know it
  // was not honoured. Omitting it entirely is still fine.
  if (plan !== undefined && !isTrialablePlan(plan)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `plan must be one of ${TRIALABLE_PLANS.join(", ")}`
    );
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

    // Start the card-free trial. It is granted here, inside the same
    // transaction that establishes ownership, because this is the one server
    // call every signup passes through — and because the client cannot write
    // `plan` itself. `isEligibleForTrial` keeps a retried or replayed claim
    // from extending a window that already started.
    if (isEligibleForTrial(companySnap.data())) {
      tx.update(companyRef, {
        ...newTrialGrant(plan),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      trialGranted = true;
    }
  });

  await applyStaffClaims(uid);
  return { companyId, role: "super_admin", trialGranted };
});

/**
 * Switches which package a running trial is evaluating.
 *
 * Trying one plan should not force a purchase to see another, so the company
 * can move its remaining days to a different package. `trialEndsAt` is never
 * touched — only the plan changes, so this cannot be used to stretch the
 * week. Once the trial is over (or a subscription exists) this refuses: at
 * that point changing plans means Stripe checkout or the billing portal.
 */
export const selectTrialPlan = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }

  const { plan } = (data ?? {}) as { plan?: unknown };
  if (!isTrialablePlan(plan)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `plan must be one of ${TRIALABLE_PLANS.join(", ")}`
    );
  }

  const db = admin.firestore();
  const uid = context.auth.uid;

  const userSnap = await db.collection("users").doc(uid).get();
  const companyId = userSnap.get("companyId") as string | undefined;
  const role = userSnap.get("role") as string | undefined;

  if (!companyId) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "You do not belong to a company"
    );
  }
  // Same roles that may buy a plan may choose which one is being tried.
  if (!BILLING_ROLES.includes(role ?? "")) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only an owner or HR admin can change the plan"
    );
  }

  const companyRef = db.collection("companies").doc(companyId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(companyRef);
    const company = snap.data();

    if (!isTrialActive(company)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No trial is running — subscribe to change your plan"
      );
    }
    if (hasEntitledSubscription(company)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Manage a paid subscription from the billing portal"
      );
    }

    tx.update(companyRef, {
      plan,
      trialPlan: plan,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { plan };
});

/** Roles a team admin may hand out through an invitation. */
const INVITABLE_ROLES = ["hr_admin", "it_admin", "manager"];

/**
 * Returns the handful of invite fields the signup page needs to render.
 *
 * The invites collection is not client-readable (it would leak every pending
 * invitee's email, company and role to the world), and the invitee is by
 * definition not signed in yet — so reading invites/{id} straight from the
 * browser always failed with "Missing or insufficient permissions" and the
 * signup page showed "Failed to load invite details". This callable is the
 * supported way to look one up: it takes the id from the emailed link, which
 * is an unguessable UUID, and returns nothing that is not already in the
 * invitation email that was sent to that address.
 */
export const previewInvite = functions.https.onCall(async (data) => {
  const { inviteId } = (data ?? {}) as { inviteId?: unknown };
  if (typeof inviteId !== "string" || !inviteId) {
    throw new functions.https.HttpsError("invalid-argument", "inviteId required");
  }

  const snap = await admin.firestore().collection("invites").doc(inviteId).get();
  if (!snap.exists) {
    return { valid: false, reason: "not_found" as const };
  }

  const invite = snap.data()!;
  if (invite.status !== "pending") {
    return { valid: false, reason: "used" as const };
  }

  const expiresAt = invite.expiresAt as admin.firestore.Timestamp | undefined;
  if (expiresAt && expiresAt.toMillis() <= Date.now()) {
    return { valid: false, reason: "expired" as const };
  }

  return {
    valid: true as const,
    email: (invite.email as string) || "",
    companyName: (invite.companyName as string) || "",
    role: INVITABLE_ROLES.includes(invite.role) ? (invite.role as string) : "manager",
    invitedByName: (invite.invitedByName as string) || "",
  };
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
  // super_admin is deliberately absent: company ownership is granted by
  // claimCompany alone, never by an invitation. "viewer" used to be the
  // fallback here, but no such role exists in the app — it left the invitee
  // with a role the UI and firestore.rules both treat as unknown.
  const role = INVITABLE_ROLES.includes(invite.role) ? invite.role : "manager";

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
