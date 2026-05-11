import * as functions from "firebase-functions";
import { getStripe } from "./stripeClient";
import * as admin from "firebase-admin";

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
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
  const VALID_PLANS = new Set([
    "free",
    "starter",
    "growth",
    "business",
    "enterprise",
  ]);
  const isValidPlan = (p: unknown): p is string =>
    typeof p === "string" && VALID_PLANS.has(p);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const { companyId, plan } = session.metadata || {};

        if (companyId && isValidPlan(plan)) {
          await db.collection("companies").doc(companyId).update({
            plan,
            stripeSubscriptionId: session.subscription,
            stripeCustomerId: session.customer,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          functions.logger.info(`Company ${companyId} upgraded to ${plan}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const { companyId, plan } = subscription.metadata || {};

        if (companyId && isValidPlan(plan)) {
          const status = subscription.status;
          const newPlan = status === "active" || status === "trialing" ? plan : "free";
          await db.collection("companies").doc(companyId).update({
            plan: newPlan,
            stripeSubscriptionStatus: status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          functions.logger.info(`Company ${companyId} subscription updated: ${status}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const { companyId } = subscription.metadata || {};

        if (companyId) {
          await db.collection("companies").doc(companyId).update({
            plan: "free",
            stripeSubscriptionId: null,
            stripeSubscriptionStatus: "canceled",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          functions.logger.info(`Company ${companyId} downgraded to free`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;

        if (customerId) {
          const snapshot = await db
            .collection("companies")
            .where("stripeCustomerId", "==", customerId)
            .limit(1)
            .get();

          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            await doc.ref.update({
              plan: "free",
              stripeSubscriptionStatus: "past_due",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            functions.logger.info(`Company ${doc.id} downgraded to free due to payment failure`);
          }
        }
        break;
      }

      default:
        functions.logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    functions.logger.error("Webhook handler error:", err);
    res.status(500).send(`Internal Server Error: ${err.message}`);
  }
});
