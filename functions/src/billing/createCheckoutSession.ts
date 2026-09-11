import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getStripe } from "./stripeClient";
import {
  STRIPE_SECRETS,
  getPriceId,
  resolveReturnUrl,
  isBillingCycle,
  isPlanKey,
} from "./stripeConfig";

const BILLING_ROLES = ["super_admin", "hr_admin"];

/**
 * Returns the company's Stripe customer ID, creating one if needed.
 *
 * A customer ID recorded while the project ran on test keys does not exist
 * under live keys, so a stored ID is verified before it is reused and
 * transparently replaced when it belongs to another mode or was deleted.
 */
async function resolveCustomerId(
  companyRef: admin.firestore.DocumentReference,
  companyId: string,
  companyName: string,
  email: string | undefined,
  uid: string
): Promise<string> {
  const stripe = getStripe();
  const stored = (await companyRef.get()).get("stripeCustomerId") as
    | string
    | undefined;

  if (stored) {
    try {
      const existing = await stripe.customers.retrieve(stored);
      if (!existing.deleted) return stored;
    } catch (err) {
      functions.logger.warn(
        `Stored stripeCustomerId ${stored} for company ${companyId} is not ` +
          "usable with the current Stripe keys; creating a new customer.",
        err
      );
    }
  }

  const customer = await stripe.customers.create(
    {
      name: companyName,
      email,
      metadata: { companyId, firebaseUserId: uid },
    },
    // Keeps a retried call from leaving duplicate customers behind.
    { idempotencyKey: `customer:${companyId}` }
  );

  await companyRef.update({ stripeCustomerId: customer.id });
  return customer.id;
}

export const createCheckoutSession = functions
  .runWith({ secrets: [...STRIPE_SECRETS] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }

    const { plan, billingCycle = "monthly", returnOrigin } = (data ?? {}) as {
      plan?: unknown;
      billingCycle?: unknown;
      returnOrigin?: unknown;
    };

    if (!isPlanKey(plan)) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid plan selected.");
    }
    if (!isBillingCycle(billingCycle)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Billing cycle must be 'monthly' or 'annual'."
      );
    }

    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(context.auth.uid).get();
    const userData = userDoc.data();

    if (!userData?.companyId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No company associated with this user."
      );
    }

    // Billing changes are restricted to team admins so a regular HR or IT
    // user can't start an unauthorized paid subscription on the company.
    if (!BILLING_ROLES.includes(userData.role as string)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only team admins can change the subscription."
      );
    }

    const companyId = userData.companyId as string;
    const companyRef = db.collection("companies").doc(companyId);
    const companyDoc = await companyRef.get();
    const companyData = companyDoc.data();

    if (!companyData) {
      throw new functions.https.HttpsError("not-found", "Company not found.");
    }

    // An existing subscription is changed through the billing portal. Sending
    // the customer through checkout again would bill them for a second
    // concurrent subscription.
    const activeStatuses = ["active", "trialing", "past_due"];
    if (
      companyData.stripeSubscriptionId &&
      activeStatuses.includes(companyData.stripeSubscriptionStatus as string)
    ) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "This company already has a subscription. Use “Manage billing” to " +
          "change or cancel your plan."
      );
    }

    // Configuration errors (missing live price IDs, missing APP_URL) surface
    // here rather than as an opaque Stripe failure mid-checkout.
    //
    // The return URL follows the origin the caller is actually running on
    // (allowlisted in resolveReturnUrl), so paying from the app comes back to
    // the app instead of to whatever single address APP_URL names.
    let priceId: string;
    let appUrl: string;
    try {
      priceId = getPriceId(plan, billingCycle);
      appUrl = resolveReturnUrl(returnOrigin);
    } catch (err) {
      functions.logger.error("Stripe billing is misconfigured.", err);
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Billing is not fully configured. Please contact support."
      );
    }

    const customerId = await resolveCustomerId(
      companyRef,
      companyId,
      companyData.name as string,
      userData.email as string | undefined,
      context.auth.uid
    );

    const automaticTax = process.env.STRIPE_AUTOMATIC_TAX === "true";
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: companyId,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      // Stripe Tax must be activated on the account before this can be
      // turned on, so it is opt-in: enabling it blindly makes every
      // checkout creation fail on accounts without Tax.
      ...(automaticTax
        ? {
            automatic_tax: { enabled: true as const },
            customer_update: { address: "auto" as const, name: "auto" as const },
          }
        : {}),
      metadata: {
        companyId,
        plan,
        billingCycle,
        firebaseUserId: context.auth.uid,
      },
      subscription_data: {
        metadata: { companyId, plan, billingCycle },
      },
      success_url: `${appUrl}/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/settings/billing?checkout=canceled`,
    });

    return { url: session.url };
  });
