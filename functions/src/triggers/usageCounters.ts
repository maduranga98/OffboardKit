import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Maintains companies/{id}.usageCount.
 *
 * The counters used to be written by the browser alongside the flow itself,
 * which firestore.rules correctly refuses — billing state is not the client's
 * to set — so every offboarding creation failed. Keeping them here means the
 * numbers the Basic-plan cap is judged on can only ever be moved by the
 * server, and they stay correct no matter how a flow is created (UI, import,
 * or a future API).
 */

/** Statuses that no longer occupy an "active offboarding" slot. */
const CLOSED_STATUSES = new Set(["completed", "cancelled", "canceled"]);

function isClosed(status: unknown): boolean {
  return typeof status === "string" && CLOSED_STATUSES.has(status);
}

export const onFlowCreatedUpdateUsage = functions.firestore
  .document("offboardFlows/{flowId}")
  .onCreate(async (snapshot) => {
    const companyId = snapshot.get("companyId") as string | undefined;
    if (!companyId) {
      functions.logger.error(
        `Flow ${snapshot.id} has no companyId; usage counters not updated`
      );
      return;
    }

    const closedAtCreation = isClosed(snapshot.get("status"));

    await admin
      .firestore()
      .collection("companies")
      .doc(companyId)
      .update({
        "usageCount.offboardingsThisYear": admin.firestore.FieldValue.increment(1),
        // A flow imported as already-closed never occupies a slot.
        ...(closedAtCreation
          ? {}
          : {
              "usageCount.activeOffboardings":
                admin.firestore.FieldValue.increment(1),
            }),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  });

export const onFlowStatusChangedUpdateUsage = functions.firestore
  .document("offboardFlows/{flowId}")
  .onUpdate(async (change) => {
    const before = change.before.get("status");
    const after = change.after.get("status");

    // Only the open ⇄ closed transition moves the counter, so repeated writes
    // to an already-completed flow can't drive it negative.
    const wasClosed = isClosed(before);
    const nowClosed = isClosed(after);
    if (wasClosed === nowClosed) return;

    const companyId = change.after.get("companyId") as string | undefined;
    if (!companyId) return;

    const delta = nowClosed ? -1 : 1;
    const companyRef = admin.firestore().collection("companies").doc(companyId);

    // A clamped transaction rather than a bare increment: a counter that has
    // drifted (legacy data, a deleted flow) must not go below zero.
    await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(companyRef);
      if (!snap.exists) return;

      const current = (snap.get("usageCount.activeOffboardings") as number) ?? 0;
      tx.update(companyRef, {
        "usageCount.activeOffboardings": Math.max(0, current + delta),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  });
