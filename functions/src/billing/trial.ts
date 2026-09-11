import * as admin from "firebase-admin";

/**
 * Card-free product trial.
 *
 * A new company is put on the Starter plan for seven days without entering
 * payment details and without any Stripe object existing — there is no
 * subscription, no customer, and nothing to cancel. The trial simply expires:
 * `expireTrials` sweeps companies whose window has closed back to Basic, and
 * the client re-derives the same thing from `trialEndsAt` so a company never
 * keeps paid features in the gap between expiry and the next sweep.
 *
 * Everything here is server-only. firestore.rules bars clients from writing
 * `plan` or any `trial*` field, so a trial can neither be self-granted nor
 * self-extended.
 */

export const TRIAL_PLAN = "starter";
export const TRIAL_DAYS = 7;

export type TrialStatus = "active" | "expired" | "converted";

/** Fields that start a fresh trial, for merging into a company document. */
export function newTrialGrant(now: Date = new Date()): Record<string, unknown> {
  const endsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  return {
    plan: TRIAL_PLAN,
    trialPlan: TRIAL_PLAN,
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
