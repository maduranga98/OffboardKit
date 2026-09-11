import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getStripe } from "./stripeClient";
import { STRIPE_SECRETS, getAppUrl } from "./stripeConfig";

const BILLING_ROLES = ["super_admin", "hr_admin"];

/**
 * Opens the Stripe customer billing portal.
 *
 * This is the supported path for changing a plan, updating a card, pulling
 * invoices, and cancelling — none of which the app implements itself, and a
 * self-serve cancellation route is expected of any live subscription product.
 */
export const createBillingPortalSession = functions
  .runWith({ secrets: [...STRIPE_SECRETS] })
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }

    const db = admin.firestore();
    const userData = (await db.collection("users").doc(context.auth.uid).get()).data();

    if (!userData?.companyId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No company associated with this user."
      );
    }

    if (!BILLING_ROLES.includes(userData.role as string)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only team admins can manage billing."
      );
    }

    const companyData = (
      await db.collection("companies").doc(userData.companyId as string).get()
    ).data();

    const customerId = companyData?.stripeCustomerId as string | undefined;
    if (!customerId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "This company has no billing account yet. Choose a plan first."
      );
    }

    let appUrl: string;
    try {
      appUrl = getAppUrl();
    } catch (err) {
      functions.logger.error("Stripe billing is misconfigured.", err);
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Billing is not fully configured. Please contact support."
      );
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/settings/billing`,
    });

    return { url: session.url };
  });
