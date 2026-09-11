import type { Company, CompanyPlan } from "../types/company.types";
import { getTrialState, type TrialState } from "./trial";

/**
 * Whether a company may use the product at all.
 *
 * Every plan in the price list is paid — "basic" is $10/month, not a free
 * tier — so the seven-day card-free trial is the only way to use OffboardKit
 * without a subscription. When it runs out and nothing has been bought, the
 * company is locked: the app blocks, and firestore.rules stops accepting
 * writes from it (see `companyActive()` there, which derives the same thing
 * from the same fields).
 *
 * The derivation is deliberately duplicated rather than stored: a saved
 * `accessStatus` field would lag the trial deadline by up to an hour (the
 * expireTrials sweep interval) and could drift from Stripe. Reading it off
 * `trialEndsAt` and the subscription status means the client, the rules and
 * the Cloud Functions all close access at the same instant.
 */

/** Subscription statuses that still entitle a company to its plan. */
export const ENTITLED_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
] as const;

export type AccessStatus =
  /** Paying (or in a Stripe-side trial) — full access. */
  | "subscribed"
  /** Inside the card-free Starter trial. */
  | "trialing"
  /** Trial over or subscription gone, nothing bought — app blocked. */
  | "locked"
  /**
   * Predates trials and has never touched Stripe. Left open so the rollout
   * cannot lock existing tenants out overnight; the backfill in expireTrials
   * hands each of these a real trial window, after which they lock normally.
   */
  | "legacy";

export interface AccessState {
  status: AccessStatus;
  /** The app must be blocked. */
  isLocked: boolean;
  /** Locked after a trial ran out, as opposed to a cancelled subscription. */
  lockedAfterTrial: boolean;
  trial: TrialState;
  /** Plan the company may actually use; null while locked. */
  entitledPlan: CompanyPlan | null;
}

/** True when Stripe reports a subscription that still entitles the plan. */
export function hasEntitledSubscription(company: Company | null): boolean {
  if (!company) return false;
  const status = company.stripeSubscriptionStatus;
  return (
    !!company.stripeSubscriptionId &&
    !!status &&
    (ENTITLED_SUBSCRIPTION_STATUSES as readonly string[]).includes(status)
  );
}

/**
 * True once a company has been through billing at all — it was granted a
 * trial, or Stripe has reported a subscription for it at some point.
 *
 * `stripeCustomerId` deliberately does not count: createCheckoutSession
 * creates the customer before any payment, so a company that merely opened
 * checkout and walked away would otherwise read as billed.
 */
function isBillingManaged(company: Company): boolean {
  return (
    company.trialStatus !== undefined ||
    company.stripeSubscriptionId !== undefined ||
    company.stripeSubscriptionStatus !== undefined
  );
}

export function getAccessState(
  company: Company | null,
  now: Date = new Date()
): AccessState {
  const trial = getTrialState(company, now);

  if (!company) {
    // No company loaded yet: not a lock, just nothing to judge. AppLayout
    // sends these users to /setup before any of this matters.
    return {
      status: "legacy",
      isLocked: false,
      lockedAfterTrial: false,
      trial,
      entitledPlan: null,
    };
  }

  if (hasEntitledSubscription(company)) {
    return {
      status: "subscribed",
      isLocked: false,
      lockedAfterTrial: false,
      trial,
      entitledPlan: company.plan ?? "basic",
    };
  }

  if (trial.isActive) {
    return {
      status: "trialing",
      isLocked: false,
      lockedAfterTrial: false,
      trial,
      entitledPlan: company.trialPlan ?? company.plan ?? "starter",
    };
  }

  if (!isBillingManaged(company)) {
    return {
      status: "legacy",
      isLocked: false,
      lockedAfterTrial: false,
      trial,
      entitledPlan: company.plan ?? "basic",
    };
  }

  return {
    status: "locked",
    isLocked: true,
    lockedAfterTrial: company.trialStatus === "active" || company.trialStatus === "expired",
    trial,
    entitledPlan: null,
  };
}
