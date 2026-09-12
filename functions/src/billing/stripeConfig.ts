/**
 * Central Stripe configuration.
 *
 * Everything environment-specific lives here so that switching from test
 * to live mode is a matter of setting secrets — never of editing code.
 *
 * Required secrets (Secret Manager, see README "Going live with Stripe"):
 *   STRIPE_SECRET_KEY      sk_live_… / sk_test_…
 *   STRIPE_WEBHOOK_SECRET  whsec_… for the deployed endpoint
 *
 * Price IDs are plain environment variables (functions/.env or
 * `firebase functions:config`), one per plan and billing cycle. They are not
 * secret, but they ARE mode-specific: a price created in test mode does not
 * exist in live mode, so live keys with test price IDs fail every checkout
 * with "No such price". `getPriceId` refuses that combination up front.
 */

/**
 * A deployment problem, not a request problem.
 *
 * Thrown for anything the operator has to fix — an unset secret, a missing
 * live price ID, an APP_URL that was never configured. Callables map it to
 * `failed-precondition` with an actionable message rather than an opaque
 * `internal` 500 (see billingErrors.ts).
 */
export class BillingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingConfigError";
  }
}

/** Secrets every billing function must bind, for `runWith({ secrets })`. */
export const STRIPE_SECRETS = ["STRIPE_SECRET_KEY"] as const;
export const STRIPE_WEBHOOK_SECRETS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;

export type PlanKey = "basic" | "starter" | "growth" | "business";
export type BillingCycle = "monthly" | "annual";

export const PAID_PLANS: readonly PlanKey[] = [
  "basic",
  "starter",
  "growth",
  "business",
];

export const PLAN_LABELS: Record<PlanKey, string> = {
  basic: "Basic",
  starter: "Starter",
  growth: "Growth",
  business: "Business",
};

/**
 * Test-mode price IDs, kept as a developer convenience so the emulator and
 * the Stripe test dashboard work with no extra setup. They are deliberately
 * ignored whenever the secret key is a live key.
 */
const TEST_MODE_PRICE_FALLBACKS: Record<
  PlanKey,
  Record<BillingCycle, string>
> = {
  basic: {
    monthly: "price_1Tm6PaQQchLsdaEfMTDq3GSV",
    annual: "price_1Tm6PaQQchLsdaEf5CNoFQJQ",
  },
  starter: {
    monthly: "price_1TllKHQQchLsdaEfrxFB6Iz8",
    annual: "price_1TllKHQQchLsdaEfD50Ubg8o",
  },
  growth: {
    monthly: "price_1TllLmQQchLsdaEfO4ugtag8",
    annual: "price_1TllLmQQchLsdaEf1UsLtdt6",
  },
  business: {
    monthly: "price_1TllMlQQchLsdaEfrL9XcFYD",
    annual: "price_1TllMlQQchLsdaEfWCpBmhgU",
  },
};

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && (PAID_PLANS as readonly string[]).includes(value);
}

export function isBillingCycle(value: unknown): value is BillingCycle {
  return value === "monthly" || value === "annual";
}

/** Reads the secret key, failing with an actionable message when unset. */
export function getSecretKey(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new BillingConfigError(
      "STRIPE_SECRET_KEY is not set. Locally, add it to functions/.env and " +
        "restart the emulator. When deployed, set it with " +
        "`firebase functions:secrets:set STRIPE_SECRET_KEY` and make sure the " +
        "function binds it via runWith({ secrets: [...] })."
    );
  }
  return secretKey;
}

/** True when the configured secret key is a live-mode key. */
export function isLiveMode(): boolean {
  return getSecretKey().startsWith("sk_live_");
}

/** `STRIPE_PRICE_GROWTH_ANNUAL` and friends. */
function priceEnvVar(plan: PlanKey, cycle: BillingCycle): string {
  return `STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`;
}

/**
 * Resolves the Stripe price ID for a plan/cycle.
 *
 * In live mode the environment variable is mandatory — there is no fallback,
 * because silently reaching for a test price would surface to the customer as
 * a failed checkout. In test mode the bundled test IDs fill the gap.
 */
export function getPriceId(plan: PlanKey, cycle: BillingCycle): string {
  const envVar = priceEnvVar(plan, cycle);
  const configured = process.env[envVar]?.trim();

  if (configured) {
    if (!configured.startsWith("price_")) {
      throw new BillingConfigError(
        `${envVar} is "${configured}", which is not a Stripe price ID. ` +
          "Use the price ID (price_…) from the Stripe dashboard, not the " +
          "product ID (prod_…) or a lookup key."
      );
    }
    return configured;
  }

  if (isLiveMode()) {
    throw new BillingConfigError(
      `${envVar} is not set. Live Stripe keys are configured, so every plan ` +
        "needs its live price ID — test-mode price IDs do not exist in live " +
        "mode. See README “Going live with Stripe”."
    );
  }

  return TEST_MODE_PRICE_FALLBACKS[plan][cycle];
}

/** Base URL used for checkout return links. */
export function getAppUrl(): string {
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/+$/, "");

  if (isLiveMode()) {
    throw new BillingConfigError(
      "APP_URL is not set. Live Stripe keys are configured, so checkout would " +
        "redirect customers to localhost after paying."
    );
  }

  return "http://localhost:5173";
}

/** Origin of a URL, or null when it is not a parsable absolute http(s) URL. */
function originOf(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Firebase project ID, as the runtime exposes it. */
function projectId(): string | undefined {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.GCP_PROJECT) return process.env.GCP_PROJECT;
  try {
    return JSON.parse(process.env.FIREBASE_CONFIG || "{}").projectId;
  } catch {
    return undefined;
  }
}

/**
 * Origins Stripe may send a customer back to.
 *
 * `APP_URL` is shared with the email templates, where it has to be a single
 * public address, so it is not on its own a reliable answer to "where is the
 * app?" — pointing it at a marketing site is exactly what dropped people on
 * the homepage after paying. The Firebase Hosting domains are always the app,
 * and `APP_RETURN_ORIGINS` covers a custom one (comma-separated).
 */
export function allowedReturnOrigins(): string[] {
  const origins = new Set<string>();

  const add = (value: string | undefined | null) => {
    const origin = originOf(value);
    if (origin) origins.add(origin);
  };

  add(process.env.APP_URL);
  for (const entry of (process.env.APP_RETURN_ORIGINS || "").split(",")) {
    add(entry);
  }

  const project = projectId();
  if (project) {
    add(`https://${project}.web.app`);
    add(`https://${project}.firebaseapp.com`);
  }

  if (!isLiveMode()) {
    add("http://localhost:5173");
    add("http://localhost:5000");
    add("http://127.0.0.1:5173");
  }

  return [...origins];
}

/**
 * True when Stripe may send a customer back to `origin`.
 *
 * Besides the explicit list, an https subdomain of the `APP_URL` host is
 * accepted: the app commonly lives at app.example.com while APP_URL names
 * example.com for emails, and both are the same domain under the same
 * owner. Everything else is refused — an unchecked origin here is an open
 * redirect carrying a Stripe session ID.
 */
function isAllowedReturnOrigin(origin: string): boolean {
  if (allowedReturnOrigins().includes(origin)) return true;

  const baseHost = originOf(process.env.APP_URL) ? new URL(process.env.APP_URL as string).hostname : null;
  if (!baseHost) return false;

  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.endsWith(`.${baseHost}`);
  } catch {
    return false;
  }
}

/**
 * Base URL to return a customer to after checkout or the billing portal.
 *
 * The caller passes the origin it is actually running on, so someone who
 * started from the app comes back to the app rather than to whatever single
 * address `APP_URL` happens to name. It is checked rather than trusted.
 */
export function resolveReturnUrl(requestedOrigin: unknown): string {
  const requested = typeof requestedOrigin === "string" ? originOf(requestedOrigin) : null;

  if (requested && isAllowedReturnOrigin(requested)) {
    return requested;
  }

  return getAppUrl();
}

/**
 * Reverse lookup: which plan does a Stripe price belong to?
 *
 * Needed by the webhook, because a plan changed inside the Stripe billing
 * portal updates the subscription's price without touching the metadata that
 * checkout originally wrote.
 */
export function getPlanForPriceId(priceId: string | null | undefined): PlanKey | null {
  if (!priceId) return null;

  for (const plan of PAID_PLANS) {
    for (const cycle of ["monthly", "annual"] as const) {
      let candidate: string;
      try {
        candidate = getPriceId(plan, cycle);
      } catch {
        // A plan without a configured price in this mode simply can't match.
        continue;
      }
      if (candidate === priceId) return plan;
    }
  }

  return null;
}

/** Billing cycle for a price, when it maps to a known plan. */
export function getCycleForPriceId(
  priceId: string | null | undefined
): BillingCycle | null {
  if (!priceId) return null;

  for (const plan of PAID_PLANS) {
    for (const cycle of ["monthly", "annual"] as const) {
      try {
        if (getPriceId(plan, cycle) === priceId) return cycle;
      } catch {
        continue;
      }
    }
  }

  return null;
}
