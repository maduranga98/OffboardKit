import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getStripe } from "./stripeClient";
import { STRIPE_SECRETS, resolveReturnUrl } from "./stripeConfig";
import { billingError } from "./billingErrors";

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
  .https.onCall(async (data, context) => {
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

    // Same as checkout: come back to the origin the request came from, once
    // it has been checked against the allowlist.
    const { returnOrigin } = (data ?? {}) as { returnOrigin?: unknown };

    try {
      const appUrl = resolveReturnUrl(returnOrigin);
      const stripe = getStripe();
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/settings/billing`,
      });

      return { url: session.url };
    } catch (err) {
      throw billingError(err, "Could not open the billing portal.");
    }
  });
