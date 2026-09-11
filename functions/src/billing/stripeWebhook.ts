import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getStripe } from "./stripeClient";
import {
  STRIPE_WEBHOOK_SECRETS,
  getCycleForPriceId,
  getPlanForPriceId,
  isPlanKey,
} from "./stripeConfig";

/** Plan a company falls back to when it has no paying subscription. */
const FALLBACK_PLAN = "basic";

/**
 * Subscription statuses that still entitle the company to its paid plan.
 * `past_due` is deliberately included: Stripe retries a failed payment for
 * weeks, and cutting access off on the first decline punishes customers for
 * an expiring card. Access is removed when the subscription actually ends
 * (`customer.subscription.deleted`) or Stripe gives up (`unpaid`).
 */
const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

type CompanyUpdate = Record<string, unknown>;

function withTimestamp(update: CompanyUpdate): CompanyUpdate {
  return { ...update, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
}

/** Finds the company for an event, by metadata first and customer ID second. */
async function findCompanyRef(
  db: admin.firestore.Firestore,
  companyId: unknown,
  customerId: unknown
): Promise<admin.firestore.DocumentReference | null> {
  if (typeof companyId === "string" && companyId) {
    const ref = db.collection("companies").doc(companyId);
    if ((await ref.get()).exists) return ref;
    functions.logger.warn(`Stripe event referenced unknown company ${companyId}`);
  }

  if (typeof customerId === "string" && customerId) {
    const snapshot = await db
      .collection("companies")
      .where("stripeCustomerId", "==", customerId)
      .limit(1)
      .get();
    if (!snapshot.empty) return snapshot.docs[0].ref;
  }

  return null;
}

/** Price ID on the first line of a subscription. */
function subscriptionPriceId(subscription: any): string | null {
  return subscription?.items?.data?.[0]?.price?.id ?? null;
}

/**
 * Records the event ID and reports whether this delivery is the first.
 *
 * Stripe retries deliveries and may send the same event more than once; a
 * create-only write makes the handler idempotent.
 */
async function claimEvent(
  db: admin.firestore.Firestore,
  eventId: string,
  eventType: string
): Promise<boolean> {
  try {
    await db.collection("stripeEvents").doc(eventId).create({
      type: eventType,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (err: any) {
    if (err?.code === 6 || err?.code === "already-exists") return false;
    throw err;
  }
}

export const stripeWebhook = functions
  .runWith({ secrets: [...STRIPE_WEBHOOK_SECRETS] })
  .https.onRequest(async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      functions.logger.error("STRIPE_WEBHOOK_SECRET is not set");
      res.status(500).send("Webhook secret not configured");
      return;
    }

    // Reject outright if the signature header is missing — never pass an
    // empty string to constructEvent, which would still verify against
    // the configured secret and could let unsigned requests through.
    if (typeof sig !== "string" || sig.length === 0) {
      functions.logger.warn("Stripe webhook rejected: missing stripe-signature header");
      res.status(400).send("Missing stripe-signature header");
      return;
    }

    const stripe = getStripe();
    let event: ReturnType<typeof stripe.webhooks.constructEvent>;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err: any) {
      functions.logger.error("Webhook signature verification failed.", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    const db = admin.firestore();

    try {
      if (!(await claimEvent(db, event.id, event.type))) {
        functions.logger.info(`Duplicate Stripe event ${event.id} ignored`);
        res.json({ received: true, duplicate: true });
        return;
      }

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as any;

          // A subscription checkout can complete while the first payment is
          // still processing; the subscription events below carry the final
          // word, so only a settled session grants the plan here.
          if (session.payment_status !== "paid") {
            functions.logger.info(
              `Checkout session ${session.id} completed with payment_status ` +
                `${session.payment_status}; waiting for the subscription event.`
            );
            break;
          }

          const companyId = session.metadata?.companyId ?? session.client_reference_id;
          const plan = session.metadata?.plan;
          const ref = await findCompanyRef(db, companyId, session.customer);

          if (!ref) {
            functions.logger.error(
              `checkout.session.completed ${session.id}: no matching company`
            );
            break;
          }

          const resolvedPlan = isPlanKey(plan) ? plan : null;
          await ref.update(
            withTimestamp({
              ...(resolvedPlan ? { plan: resolvedPlan } : {}),
              stripeSubscriptionId: session.subscription ?? null,
              stripeCustomerId: session.customer ?? null,
              stripeSubscriptionStatus: "active",
              ...(session.metadata?.billingCycle
                ? { billingCycle: session.metadata.billingCycle }
                : {}),
            })
          );
          functions.logger.info(`Company ${ref.id} checkout completed (${resolvedPlan})`);
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as any;
          const ref = await findCompanyRef(
            db,
            subscription.metadata?.companyId,
            subscription.customer
          );

          if (!ref) {
            functions.logger.error(
              `${event.type} ${subscription.id}: no matching company`
            );
            break;
          }

          const status = subscription.status as string;
          // The price is authoritative: a plan switched inside the billing
          // portal changes the price but leaves checkout's metadata stale.
          const priceId = subscriptionPriceId(subscription);
          const planFromPrice = getPlanForPriceId(priceId);
          const planFromMetadata = isPlanKey(subscription.metadata?.plan)
            ? (subscription.metadata.plan as string)
            : null;
          const plan = planFromPrice ?? planFromMetadata;
          const cycle = getCycleForPriceId(priceId);

          const entitled = ENTITLED_STATUSES.has(status);

          await ref.update(
            withTimestamp({
              plan: entitled && plan ? plan : FALLBACK_PLAN,
              stripeSubscriptionId: subscription.id,
              stripeSubscriptionStatus: status,
              ...(cycle ? { billingCycle: cycle } : {}),
            })
          );
          functions.logger.info(
            `Company ${ref.id} subscription ${status} → plan ` +
              `${entitled && plan ? plan : FALLBACK_PLAN}`
          );
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as any;
          const ref = await findCompanyRef(
            db,
            subscription.metadata?.companyId,
            subscription.customer
          );

          if (!ref) {
            functions.logger.error(
              `customer.subscription.deleted ${subscription.id}: no matching company`
            );
            break;
          }

          await ref.update(
            withTimestamp({
              plan: FALLBACK_PLAN,
              stripeSubscriptionId: null,
              stripeSubscriptionStatus: "canceled",
            })
          );
          functions.logger.info(`Company ${ref.id} downgraded to ${FALLBACK_PLAN}`);
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as any;
          const ref = await findCompanyRef(db, invoice.metadata?.companyId, invoice.customer);

          if (!ref) break;

          // Flag the failure but keep the plan: Stripe retries for weeks, and
          // the subscription events above remove access if it never settles.
          await ref.update(
            withTimestamp({
              stripeSubscriptionStatus: "past_due",
              stripeLastPaymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
            })
          );
          functions.logger.warn(`Company ${ref.id} payment failed; marked past_due`);
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as any;
          const ref = await findCompanyRef(db, invoice.metadata?.companyId, invoice.customer);

          if (!ref) break;

          await ref.update(
            withTimestamp({
              stripeSubscriptionStatus: "active",
              stripeLastPaymentFailedAt: null,
            })
          );
          break;
        }

        default:
          functions.logger.info(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (err: any) {
      functions.logger.error("Webhook handler error:", err);
      // Release the idempotency claim so Stripe's retry can do the work.
      await db
        .collection("stripeEvents")
        .doc(event.id)
        .delete()
        .catch(() => undefined);
      res.status(500).send(`Internal Server Error: ${err.message}`);
    }
  });
