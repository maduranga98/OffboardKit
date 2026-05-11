import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Runs at 00:05 UTC on Jan 1 each year and resets per-company annual
// counters so usage-based plan gates (free tier offboarding cap, etc.)
// don't lock out customers on day one of a new year.
// activeOffboardings is intentionally untouched — those are still in
// flight and don't roll over.
export const resetAnnualUsage = functions.pubsub
  .schedule("5 0 1 1 *")
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const snap = await db.collection("companies").get();
    const writer = db.bulkWriter();
    let count = 0;
    for (const doc of snap.docs) {
      writer.update(doc.ref, {
        "usageCount.offboardingsThisYear": 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      count++;
    }
    await writer.close();
    functions.logger.info(
      `Annual usage reset: cleared offboardingsThisYear for ${count} companies`
    );
  });
