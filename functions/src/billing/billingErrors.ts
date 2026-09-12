import * as functions from "firebase-functions";
import { BillingConfigError } from "./stripeConfig";

/**
 * Turns a failure from the Stripe layer into an HttpsError the Billing page
 * can act on.
 *
 * Every billing failure used to collapse into `internal`, which reaches the
 * browser as a bare `500` with "Please try again" — advice that can never
 * work when the real problem is that `STRIPE_SECRET_KEY` was never bound to
 * the function, or that the live price IDs are missing. Those are
 * `failed-precondition`: the request was fine, the deployment is not, and the
 * message says so instead of inviting an endless retry.
 *
 * Stripe's own 4xx families are separated for the same reason. Only genuine
 * server-side faults stay `internal`.
 */
export function billingError(
  err: unknown,
  fallbackMessage: string
): functions.https.HttpsError {
  // Already deliberate — pass it through untouched.
  if (err instanceof functions.https.HttpsError) return err;

  if (err instanceof BillingConfigError) {
    functions.logger.error("Stripe billing is misconfigured.", err);
    return new functions.https.HttpsError(
      "failed-precondition",
      "Billing is not configured on the server. Please contact support."
    );
  }

  const type = (err as { type?: string } | null)?.type;

  switch (type) {
    // Wrong, revoked, or mode-mismatched API key; the key lacks the grant.
    case "StripeAuthenticationError":
    case "StripePermissionError":
      functions.logger.error(
        "Stripe rejected the configured API key. Check STRIPE_SECRET_KEY.",
        err
      );
      return new functions.https.HttpsError(
        "failed-precondition",
        "Billing is not configured correctly on the server. Please contact " +
          "support."
      );

    // A price or customer that does not exist in this Stripe mode, a bad
    // parameter — a deployment or data problem, never a transient one.
    case "StripeInvalidRequestError":
      functions.logger.error("Stripe rejected the request.", err);
      return new functions.https.HttpsError(
        "failed-precondition",
        `${fallbackMessage} Billing may not be fully set up — please contact ` +
          "support."
      );

    case "StripeConnectionError":
    case "StripeAPIError":
    case "StripeRateLimitError":
      functions.logger.error("Stripe is unavailable right now.", err);
      return new functions.https.HttpsError(
        "unavailable",
        `${fallbackMessage} Please try again in a moment.`
      );

    case "StripeCardError":
      functions.logger.warn("Stripe declined the card.", err);
      return new functions.https.HttpsError(
        "failed-precondition",
        (err as { message?: string }).message ?? fallbackMessage
      );

    default:
      functions.logger.error(fallbackMessage, err);
      return new functions.https.HttpsError("internal", fallbackMessage);
  }
}
