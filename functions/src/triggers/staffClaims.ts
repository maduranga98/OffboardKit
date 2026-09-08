import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Mirrors users/{uid}.companyId and .role into Firebase Auth custom claims.
 *
 * Storage rules cannot read Firestore reliably (cross-service access is
 * unavailable in the emulator and costs a document read per object operation),
 * so object paths under companies/{companyId}/ are authorized from the token
 * instead. Firestore rules keep using the /users document directly.
 *
 * Claims are written here and by the membership callables, so a caller never
 * has to wait a trigger round-trip after joining a company.
 */
export async function applyStaffClaims(uid: string): Promise<{
  companyId: string;
  role: string;
}> {
  const db = admin.firestore();
  const snap = await db.collection("users").doc(uid).get();
  const data = snap.data();
  const companyId = typeof data?.companyId === "string" ? data.companyId : "";
  const role = typeof data?.role === "string" ? data.role : "";

  const user = await admin.auth().getUser(uid);
  const existing = user.customClaims ?? {};

  // Never clobber portal/survey claims — those identities are separate.
  if (existing.portal === true || existing.survey === true) {
    return { companyId: "", role: "" };
  }
  if (existing.companyId === companyId && existing.role === role) {
    return { companyId, role };
  }

  await admin.auth().setCustomUserClaims(uid, { ...existing, companyId, role });
  return { companyId, role };
}

export const syncStaffClaims = functions.firestore
  .document("users/{uid}")
  .onWrite(async (change, context) => {
    const uid = context.params.uid as string;
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    if (
      before?.companyId === after?.companyId &&
      before?.role === after?.role
    ) {
      return;
    }

    await applyStaffClaims(uid).catch((err) =>
      functions.logger.error("applyStaffClaims failed", uid, err)
    );
  });

/**
 * Self-heal: lets a signed-in user re-sync their own claims. The client calls
 * this when its ID token is missing the companyId claim (existing accounts
 * created before claims were introduced, or a token issued mid-change).
 */
export const refreshMyClaims = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }
  return applyStaffClaims(context.auth.uid);
});
