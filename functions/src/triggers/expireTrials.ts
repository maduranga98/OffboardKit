import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { hasEntitledSubscription } from "../billing/access";
import { newTrialGrant } from "../billing/trial";

/**
 * Closes out Starter trials whose seven days have run out, and backfills a
 * trial onto companies that predate trials entirely.
 *
 * Expiry is not a downgrade to a free tier — there is no free tier. Once the
 * window closes with nothing bought, the company is locked: the app blocks it
 * and firestore.rules stops accepting its writes, both derived live from
 * `trialStatus`/`trialEndsAt` so the cut-off lands on the deadline rather than
 * whenever this sweep next runs. `plan` is set back to the entry plan only so
 * the billing page has something coherent to show; it grants nothing while the
 * company is locked.
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

    await backfillLegacyTrials(db);
  });

/** Where the backfill records its progress between runs. */
const BACKFILL_STATE = "system/trialBackfill";

/** Companies examined per sweep — a ceiling on the work one run can do. */
const BACKFILL_PAGE = 500;

/**
 * Gives a trial to companies created before trials existed.
 *
 * Access is derived from trial and subscription fields, and a company with
 * neither is treated as "legacy" and left open — otherwise shipping the lock
 * would have shut every existing tenant out with no notice. This hands each
 * of them the same seven days a new signup gets; once that window closes they
 * lock like everyone else.
 *
 * Firestore cannot query for a *missing* field, so this walks the collection
 * by document id instead, a page per run, and parks the cursor in
 * `system/trialBackfill`. Once the walk reaches the end it marks itself done
 * and never scans again — new companies get their trial from claimCompany.
 */
async function backfillLegacyTrials(db: admin.firestore.Firestore): Promise<void> {
  const stateRef = db.doc(BACKFILL_STATE);
  const state = await stateRef.get();

  if (state.get("completedAt")) return;

  const cursor = state.get("cursor") as string | undefined;
  let query = db
    .collection("companies")
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(BACKFILL_PAGE);

  if (cursor) query = query.startAfter(cursor);

  const page = await query.get();

  if (page.empty) {
    await stateRef.set(
      {
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        cursor: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );
    functions.logger.info("Trial backfill: complete, no companies left to scan");
    return;
  }

  const writer = db.bulkWriter();
  let granted = 0;
  let converted = 0;

  for (const doc of page.docs) {
    // Anything that already carries trial state has been through this.
    if (doc.get("trialStatus") !== undefined) continue;

    // A company already paying needs no trial; recording it as converted
    // keeps the lock derivation honest if the subscription later ends.
    if (hasEntitledSubscription(doc.data())) {
      writer.update(doc.ref, {
        trialStatus: "converted",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      converted++;
      continue;
    }

    writer.update(doc.ref, {
      ...newTrialGrant(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    granted++;
  }

  await writer.close();
  await stateRef.set(
    { cursor: page.docs[page.docs.length - 1].id },
    { merge: true }
  );

  functions.logger.info(
    `Trial backfill: scanned ${page.size}, ${granted} started a trial, ` +
      `${converted} marked converted`
  );
}
