import * as functions from "firebase-functions";
import { getStripe } from "./stripeClient";
import * as admin from "firebase-admin";

const PLAN_PRICES: Record<
  string,
  { monthly: number; annual: number; label: string }
> = {
  starter: { monthly: 2900, annual: 2400, label: "Starter" },
  growth: { monthly: 7900, annual: 6600, label: "Growth" },
  business: { monthly: 19900, annual: 16600, label: "Business" },
};

export const createCheckoutSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { plan, billingCycle = "monthly" } = data as {
    plan: string;
    billingCycle?: "monthly" | "annual";
  };

  if (!["starter", "growth", "business"].includes(plan)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid plan selected.");
  }

  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(context.auth.uid).get();
  const userData = userDoc.data();

  if (!userData?.companyId) {
    throw new functions.https.HttpsError("failed-precondition", "No company associated with this user.");
  }

  const companyId = userData.companyId;
  const companyDoc = await db.collection("companies").doc(companyId).get();
  const companyData = companyDoc.data();

  if (!companyData) {
    throw new functions.https.HttpsError("not-found", "Company not found.");
  }

  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const priceConfig = PLAN_PRICES[plan];
  const unitAmount = billingCycle === "annual" ? priceConfig.annual : priceConfig.monthly;
  const interval = billingCycle === "annual" ? "year" : "month";

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
        price_data: {
          currency: "usd",
          product_data: {
            name: `OffboardKit ${priceConfig.label}`,
            description: `${priceConfig.label} plan — billed ${billingCycle}`,
          },
          recurring: { interval },
          unit_amount: unitAmount,
        },
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
