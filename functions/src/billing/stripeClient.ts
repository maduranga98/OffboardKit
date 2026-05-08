import Stripe from "stripe";

type StripeInstance = InstanceType<typeof Stripe>;

let _stripe: StripeInstance | null = null;

export function getStripe(): StripeInstance {
  if (_stripe) return _stripe;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. " +
        "If running locally, make sure functions/.env exists and restart the Firebase emulator. " +
        "If deployed, set it via firebase functions:config:set stripe.secret_key=... or use a .env file."
    );
  }

  _stripe = new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia",
  });

  return _stripe;
}
