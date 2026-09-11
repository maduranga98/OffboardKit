import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Server-side half of the subscription lock.
 *
 * Mirrors src/lib/access.ts and the `companyActive()` helper in
 * firestore.rules — the same three fields, the same answer. Callable
 * functions have to check it themselves: they run with the admin SDK, so
 * security rules never see their writes.
 */

/** Subscription statuses that still entitle a company to its plan. */
export const ENTITLED_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];

export type AccessStatus = "subscribed" | "trialing" | "locked" | "legacy";

type CompanyData = admin.firestore.DocumentData | undefined;

export function hasEntitledSubscription(company: CompanyData): boolean {
  const status = company?.stripeSubscriptionStatus as string | undefined;
  return (
    !!company?.stripeSubscriptionId &&
    !!status &&
    ENTITLED_SUBSCRIPTION_STATUSES.includes(status)
  );
}

function trialRunning(company: CompanyData, now: Date): boolean {
  if (company?.trialStatus !== "active") return false;
  const endsAt = company.trialEndsAt as admin.firestore.Timestamp | undefined;
  return !!endsAt && endsAt.toMillis() > now.getTime();
}

/**
 * Whether billing has ever taken hold of this company.
 *
 * `stripeCustomerId` is excluded on purpose: createCheckoutSession creates
 * the customer before any payment, so a company that opened checkout and
 * abandoned it must not read as billed.
 */
function isBillingManaged(company: CompanyData): boolean {
  return (
    company?.trialStatus !== undefined ||
    company?.stripeSubscriptionId !== undefined ||
    company?.stripeSubscriptionStatus !== undefined
  );
}

export function getAccessStatus(
  company: CompanyData,
  now: Date = new Date()
): AccessStatus {
  if (!company) return "locked";
  if (hasEntitledSubscription(company)) return "subscribed";
  if (trialRunning(company, now)) return "trialing";
  // Predates trials and has never touched Stripe: left open so the rollout
  // cannot lock existing tenants out. The expireTrials backfill gives each of
  // these a real trial window, after which it locks like everyone else.
  if (!isBillingManaged(company)) return "legacy";
  return "locked";
}

export function isCompanyLocked(company: CompanyData, now: Date = new Date()): boolean {
  return getAccessStatus(company, now) === "locked";
}

/**
 * Throws unless the company may still use the product.
 *
 * `failed-precondition` rather than `permission-denied`: nothing is wrong
 * with the caller's identity, the account simply needs a plan. Clients match
 * on the message to route to billing.
 */
export async function assertCompanyActive(companyId: string): Promise<void> {
  const snap = await admin.firestore().collection("companies").doc(companyId).get();

  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "Company not found");
  }

  if (isCompanyLocked(snap.data())) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "subscription-required: your free trial has ended. Choose a plan to " +
        "continue using OffboardKit."
    );
  }
}
