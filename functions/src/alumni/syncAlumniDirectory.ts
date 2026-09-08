import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Maintains alumniDirectory/{authUid} -> { companyId, profileId }.
 *
 * Alumni authenticate against the same Firebase Auth project as company staff
 * but have no /users document, so security rules had no way to tell which
 * tenant an alumni belongs to — which is why the alumni collections were
 * previously readable by any signed-in user. This index gives rules a single
 * uid-keyed lookup to scope alumni reads to their own company.
 *
 * Written only by this trigger (admin SDK); clients cannot write it.
 */
export const syncAlumniDirectory = functions.firestore
  .document("alumniProfiles/{profileId}")
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    const db = admin.firestore();
    const profileId = context.params.profileId;

    const beforeUid = before?.authUid as string | undefined;
    const afterUid = after?.authUid as string | undefined;

    // Profile deleted, or the linked auth account changed — drop the stale row.
    if (beforeUid && beforeUid !== afterUid) {
      await db
        .collection("alumniDirectory")
        .doc(beforeUid)
        .delete()
        .catch((err) =>
          functions.logger.error("alumniDirectory cleanup failed", beforeUid, err)
        );
    }

    if (!after || !afterUid || typeof after.companyId !== "string") return;

    await db
      .collection("alumniDirectory")
      .doc(afterUid)
      .set(
        {
          companyId: after.companyId,
          profileId,
          email: after.email ?? null,
          optedIn: after.optedIn === true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .catch((err) =>
        functions.logger.error("alumniDirectory write failed", afterUid, err)
      );
  });

/**
 * One-off backfill for alumni who linked their authUid before the directory
 * existed. Restricted to team admins of the company being backfilled.
 */
export const backfillAlumniDirectory = functions.https.onCall(
  async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const db = admin.firestore();
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    const caller = callerDoc.data();
    if (
      !caller ||
      !["super_admin", "hr_admin"].includes(caller.role) ||
      !caller.companyId
    ) {
      throw new functions.https.HttpsError("permission-denied", "Not authorized");
    }

    const snap = await db
      .collection("alumniProfiles")
      .where("companyId", "==", caller.companyId)
      .get();

    let written = 0;
    let batch = db.batch();
    let pending = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.authUid) continue;
      batch.set(
        db.collection("alumniDirectory").doc(data.authUid),
        {
          companyId: data.companyId,
          profileId: doc.id,
          email: data.email ?? null,
          optedIn: data.optedIn === true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      written++;
      pending++;
      if (pending === 400) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
    if (pending > 0) await batch.commit();

    return { written };
  }
);
