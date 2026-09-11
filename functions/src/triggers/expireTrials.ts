import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Closes out Starter trials whose seven days have run out.
 *
 * A company that subscribed during the trial is left alone — the Stripe
 * webhook marks it `converted`, and its plan is the subscription's to set.
 * Everyone else drops back to Basic.
 *
 * Runs hourly rather than daily so a trial ends near the hour it was granted
 * instead of up to a day late. The client applies the same cut-off from
 * `trialEndsAt`, so paid features stop at the deadline regardless of when
 * this sweep next runs; the sweep is what makes it durable.
 */
export const expireTrials = functions.pubsub
  .schedule("0 * * * *")
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    const due = await db
      .collection("companies")
      .where("trialStatus", "==", "active")
      .where("trialEndsAt", "<=", now)
      .get();

    if (due.empty) return;

    const writer = db.bulkWriter();
    let expired = 0;
    let skipped = 0;

    for (const doc of due.docs) {
      // A live subscription outranks the trial: the webhook is the authority
      // on plan for paying companies, and this sweep must not undo it.
      const status = doc.get("stripeSubscriptionStatus") as string | undefined;
      const hasSubscription =
        !!doc.get("stripeSubscriptionId") &&
        ["active", "trialing", "past_due"].includes(status ?? "");

      if (hasSubscription) {
        writer.update(doc.ref, {
          trialStatus: "converted",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        skipped++;
        continue;
      }

      writer.update(doc.ref, {
        plan: "basic",
        trialStatus: "expired",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      expired++;
    }

    await writer.close();
    functions.logger.info(
      `Trial sweep: ${expired} expired to basic, ${skipped} already subscribed`
    );
  });
