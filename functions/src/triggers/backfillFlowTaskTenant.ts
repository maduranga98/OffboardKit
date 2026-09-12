import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * One-off backfill for flowTasks written before the documents carried a
 * `companyId`.
 *
 * firestore.rules scopes every flowTasks read and write through
 * `resource.data.companyId`. Tasks created without that field are therefore
 * invisible to their own tenant and cannot be completed from the exit portal
 * (the portal update requires `tenantUnchanged()`, which needs the field on
 * both sides). This stamps the owning flow's tenant onto every task that is
 * missing one.
 *
 * Restricted to team admins, and scoped to the caller's own company.
 */
export const backfillFlowTaskTenant = functions.https.onCall(
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

    const companyId = caller.companyId as string;
    const flowsSnap = await db
      .collection("offboardFlows")
      .where("companyId", "==", companyId)
      .get();

    let written = 0;
    let scanned = 0;
    let batch = db.batch();
    let pending = 0;

    // `in` queries cap at 30 values, and a task may predate the flowId
    // denormalisation on either side, so walk one flow at a time.
    for (const flowDoc of flowsSnap.docs) {
      const tasksSnap = await db
        .collection("flowTasks")
        .where("flowId", "==", flowDoc.id)
        .get();

      for (const taskDoc of tasksSnap.docs) {
        scanned++;
        if (taskDoc.get("companyId") === companyId) continue;
        batch.update(taskDoc.ref, { companyId });
        written++;
        pending++;
        if (pending === 400) {
          await batch.commit();
          batch = db.batch();
          pending = 0;
        }
      }
    }

    if (pending > 0) await batch.commit();

    functions.logger.info("backfillFlowTaskTenant", { companyId, scanned, written });
    return { scanned, written };
  }
);
