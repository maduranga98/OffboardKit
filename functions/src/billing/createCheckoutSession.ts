import * as functions from "firebase-functions";
import { getStripe } from "./stripeClient";
import * as admin from "firebase-admin";

const PLAN_PRICES: Record<
  string,
  { monthly: string; annual: string; label: string }
> = {
  basic: {
    // TODO: replace with live Stripe price IDs once created in the dashboard
    monthly: "price_BASIC_MONTHLY_PLACEHOLDER",
    annual: "price_BASIC_ANNUAL_PLACEHOLDER",
    label: "Basic",
  },
  starter: {
    monthly: "price_1TllKHQQchLsdaEfrxFB6Iz8",
    annual: "price_1TllKHQQchLsdaEfD50Ubg8o",
    label: "Starter",
  },
  growth: {
    monthly: "price_1TllLmQQchLsdaEfO4ugtag8",
    annual: "price_1TllLmQQchLsdaEf1UsLtdt6",
    label: "Growth",
  },
  business: {
    monthly: "price_1TllMlQQchLsdaEfrL9XcFYD",
    annual: "price_1TllMlQQchLsdaEfWCpBmhgU",
    label: "Business",
  },
};

export const createCheckoutSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { plan, billingCycle = "monthly" } = data as {
    plan: string;
    billingCycle?: "monthly" | "annual";
  };

  if (!["basic", "starter", "growth", "business"].includes(plan)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid plan selected.");
  }

  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(context.auth.uid).get();
  const userData = userDoc.data();

  if (!userData?.companyId) {
    throw new functions.https.HttpsError("failed-precondition", "No company associated with this user.");
  }

  // Billing changes are restricted to team admins so a regular HR or IT
  // user can't start an unauthorized paid subscription on the company.
  if (!["super_admin", "hr_admin"].includes(userData.role as string)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only team admins can change the subscription."
    );
  }

  const companyId = userData.companyId;
  const companyDoc = await db.collection("companies").doc(companyId).get();
  const companyData = companyDoc.data();

  if (!companyData) {
    throw new functions.https.HttpsError("not-found", "Company not found.");
  }

  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const priceConfig = PLAN_PRICES[plan];
  const priceId = billingCycle === "annual" ? priceConfig.annual : priceConfig.monthly;

  let customerId = companyData.stripeCustomerId as string | undefined;

  if (!customerId) {
    const stripe = getStripe();
    const customer = await stripe.customers.create({
      name: companyData.name,
      email: userData.email,
      metadata: { companyId, firebaseUserId: context.auth.uid },
    });
    customerId = customer.id;
    await companyDoc.ref.update({ stripeCustomerId: customerId });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      companyId,
      plan,
      billingCycle,
      firebaseUserId: context.auth.uid,
    },
    subscription_data: {
      metadata: {
        companyId,
        plan,
        billingCycle,
      },
    },
    success_url: `${appUrl}/settings/billing?checkout=success`,
    cancel_url: `${appUrl}/settings/billing?checkout=canceled`,
  });

  return { url: session.url };
});
