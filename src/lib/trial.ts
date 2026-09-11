import type { Company, CompanyPlan } from "../types/company.types";

/** Days a new company gets on Starter without entering a card. */
export const TRIAL_DAYS = 7;

export interface TrialState {
  /** A trial is running right now. */
  isActive: boolean;
  /** The trial ran and was neither converted nor is still running. */
  hasExpired: boolean;
  /** Whole days left, rounded up; 0 once the window has closed. */
  daysRemaining: number;
  endsAt: Date | null;
}

function trialEndDate(company: Company | null): Date | null {
  const endsAt = company?.trialEndsAt;
  if (!endsAt) return null;
  return typeof endsAt.toDate === "function" ? endsAt.toDate() : null;
}

export function getTrialState(
  company: Company | null,
  now: Date = new Date()
): TrialState {
  const endsAt = trialEndDate(company);
  const status = company?.trialStatus;

  const running = status === "active" && !!endsAt && endsAt.getTime() > now.getTime();
  const msLeft = endsAt ? endsAt.getTime() - now.getTime() : 0;

  return {
    isActive: running,
    hasExpired:
      status === "expired" ||
      (status === "active" && !!endsAt && endsAt.getTime() <= now.getTime()),
    daysRemaining: running ? Math.ceil(msLeft / (24 * 60 * 60 * 1000)) : 0,
    endsAt,
  };
}

/**
 * The plan a company is actually entitled to right now.
 *
 * Note this is the *feature tier*, not the entitlement: whether the company
 * may use the product at all is `getAccessState` in ./access.ts, which locks
 * it once the trial ends with nothing bought. This function only answers
 * "which tier's features", and the lock overrides it.
 *
 * `company.plan` reads "starter" for the whole trial, and the hourly
 * expireTrials sweep is what puts it back to "basic". Deriving the cut-off
 * from `trialEndsAt` here means features stop at the deadline rather than
 * whenever the sweep next runs — the sweep makes it durable, this makes it
 * immediate. A paid subscription is never affected: converting sets
 * trialStatus to "converted", so this returns the subscribed plan untouched.
 */
export function getEffectivePlan(
  company: Company | null,
  now: Date = new Date()
): CompanyPlan {
  if (!company) return "basic";

  const { hasExpired } = getTrialState(company, now);
  if (hasExpired && company.trialStatus === "active") return "basic";

  return company.plan ?? "basic";
}
