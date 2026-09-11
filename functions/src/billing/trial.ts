import * as admin from "firebase-admin";

/**
 * Card-free product trial.
 *
 * A new company gets seven days as soon as it finishes setup — no payment
 * details, and no Stripe object existing: there is no subscription, no
 * customer, and nothing to cancel. Signup asks for no package, so the trial
 * runs on TRIAL_PLAN until the company moves it from Billing
 * (`selectTrialPlan`); the week ends with no charge unless they buy through
 * checkout.
 *
 * The trial simply expires. Every plan is paid, so expiry is a lock rather
 * than a downgrade: `expireTrials` closes the window, and the client and
 * firestore.rules re-derive the same cut-off from `trialEndsAt` so a company
 * never keeps features in the gap before the next sweep (see ./access.ts).
 *
 * Everything here is server-only. firestore.rules bars clients from writing
 * `plan` or any `trial*` field, so a trial can neither be self-granted nor
 * self-extended.
 */

/** Offered when the caller names no package of its own. */
export const TRIAL_PLAN = "starter";
export const TRIAL_DAYS = 7;

/**
 * Packages a company may try without a card.
 *
 * Enterprise is absent on purpose: it is quoted, not self-served, so there is
 * no price to convert to at the end of the week.
 */
export const TRIALABLE_PLANS = ["basic", "starter", "growth", "business"] as const;

export type TrialablePlan = (typeof TRIALABLE_PLANS)[number];

export type TrialStatus = "active" | "expired" | "converted";

/** Narrows an untrusted value to a package that may be trialled. */
export function isTrialablePlan(value: unknown): value is TrialablePlan {
  return (
    typeof value === "string" &&
    (TRIALABLE_PLANS as readonly string[]).includes(value)
  );
}

/**
 * Fields that start a fresh trial, for merging into a company document.
 *
 * The package defaults to TRIAL_PLAN, since signup no longer asks for one. A
 * caller may still name one, and it is validated here rather than trusted:
 * it decides which features unlock for the week.
 */
export function newTrialGrant(
  plan: unknown = TRIAL_PLAN,
  now: Date = new Date()
): Record<string, unknown> {
  const endsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const trialPlan: TrialablePlan = isTrialablePlan(plan) ? plan : TRIAL_PLAN;

  return {
    plan: trialPlan,
    trialPlan,
    trialStatus: "active" satisfies TrialStatus,
    trialStartedAt: admin.firestore.Timestamp.fromDate(now),
    trialEndsAt: admin.firestore.Timestamp.fromDate(endsAt),
  };
}

/**
 * True when a company has never been given a trial.
 *
 * Keyed on `trialStatus` rather than on the current plan, so an expired trial
 * is never silently re-granted — the field stays behind as the record that
 * this company already had its seven days.
 */
export function isEligibleForTrial(
  company: admin.firestore.DocumentData | undefined
): boolean {
  return !!company && company.trialStatus === undefined;
}

/** True when the trial window is still open at `now`. */
export function isTrialActive(
  company: admin.firestore.DocumentData | undefined,
  now: Date = new Date()
): boolean {
  if (company?.trialStatus !== "active") return false;

  const endsAt = company.trialEndsAt as admin.firestore.Timestamp | undefined;
  return !!endsAt && endsAt.toMillis() > now.getTime();
}
