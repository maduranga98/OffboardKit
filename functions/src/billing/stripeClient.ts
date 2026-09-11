import Stripe from "stripe";
import { getSecretKey } from "./stripeConfig";

type StripeInstance = InstanceType<typeof Stripe>;

let _stripe: StripeInstance | null = null;
let _stripeKey: string | null = null;

export function getStripe(): StripeInstance {
  const secretKey = getSecretKey();

  // Cache per key: a warm instance that outlives a secret rotation must not
  // keep talking to Stripe with the retired key.
  if (_stripe && _stripeKey === secretKey) return _stripe;

  _stripe = new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia",
    // Stripe recommends retrying idempotent requests; checkout and customer
    // creation both carry idempotency keys, so this is safe.
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: "OffboardKit", url: "https://offboardkit.web.app" },
  });
  _stripeKey = secretKey;

  return _stripe;
}
