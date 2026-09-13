import {
  Circle,
  Briefcase,
  Rocket,
  Building2,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import type { CompanyPlan } from "../types/company.types";

/**
 * The plan catalogue, shared by the setup wizard's plan step and the billing
 * page so the two can never quote different prices.
 *
 * Prices are display copy only — Stripe is the authority on what is actually
 * charged (see functions/src/billing/stripeConfig.ts). Nothing here grants
 * anything.
 */

export type PlanKey = CompanyPlan;
export type BillingCycle = "monthly" | "annual";

export const PLAN_CONFIG: Record<
  PlanKey,
  {
    label: string;
    icon: LucideIcon;
    tagline: string;
    monthly: number | null;
    annual: number | null;
    annualTotal: number | null;
    annualSaving: number | null;
    annualSavingPct: number | null;
    color: "mist" | "teal" | "navy" | "amber";
    userLimit: number | null;
    employeeLimit: number | null;
    exitLimit: number | null;
    popular?: boolean;
  }
> = {
  basic: {
    label: "Basic", icon: Circle, tagline: "Very small teams. 3 exits per year.",
    monthly: 10, annual: 8, annualTotal: 100, annualSaving: 20, annualSavingPct: 17,
    color: "mist", userLimit: 1, employeeLimit: 10, exitLimit: 3,
  },
  starter: {
    label: "Starter", icon: Briefcase, tagline: "Unlimited offboarding for small businesses",
    monthly: 29, annual: 24, annualTotal: 290, annualSaving: 58, annualSavingPct: 16,
    color: "teal", userLimit: 3, employeeLimit: 50, exitLimit: null,
  },
  growth: {
    label: "Growth", icon: Rocket, tagline: "Complete platform for growing teams",
    monthly: 79, annual: 66, annualTotal: 790, annualSaving: 158, annualSavingPct: 16,
    color: "teal", userLimit: 10, employeeLimit: 200, exitLimit: null, popular: true,
  },
  business: {
    label: "Business", icon: Building2, tagline: "Advanced AI + full alumni tools",
    monthly: 199, annual: 166, annualTotal: 1990, annualSaving: 398, annualSavingPct: 16,
    color: "navy", userLimit: 25, employeeLimit: 500, exitLimit: null,
  },
  enterprise: {
    label: "Enterprise", icon: Landmark, tagline: "White-label, SSO & compliance",
    monthly: null, annual: null, annualTotal: null, annualSaving: null, annualSavingPct: null,
    color: "amber", userLimit: null, employeeLimit: null, exitLimit: null,
  },
};

/**
 * Packages a company can try for seven days without a card. Mirrors
 * TRIALABLE_PLANS in functions/src/billing/trial.ts, which is what actually
 * validates the choice — Enterprise is quoted, not self-served, so there is
 * no price to convert to at the end of the week.
 */
export const TRIALABLE_PLANS = ["basic", "starter", "growth", "business"] as const;

export type TrialablePlan = (typeof TRIALABLE_PLANS)[number];

export function isTrialablePlan(value: unknown): value is TrialablePlan {
  return (
    typeof value === "string" &&
    (TRIALABLE_PLANS as readonly string[]).includes(value)
  );
}

/** Plan order, cheapest first — also the order they are offered in. */
export const PLAN_ORDER: PlanKey[] = [
  "basic",
  "starter",
  "growth",
  "business",
  "enterprise",
];

/**
 * Seats a package includes, counting the owner. null = unlimited.
 *
 * Mirrored server-side by PLAN_USER_LIMITS in
 * functions/src/billing/planLimits.ts, which is what actually refuses an
 * invitation — this copy only drives the UI, so the two must stay in step.
 */
export function getPlanUserLimit(plan: PlanKey | null | undefined): number | null {
  if (!plan) return null;
  return PLAN_CONFIG[plan]?.userLimit ?? null;
}

export interface SeatUsage {
  /** Members holding a seat right now. */
  activeMembers: number;
  /** Unexpired invitations, each of which is a seat already promised. */
  pendingInvites: number;
  /** What counts against the limit. */
  used: number;
  /** Seats the package allows; null = unlimited. */
  limit: number | null;
  /** Seats left, or null when unlimited. */
  remaining: number | null;
  /** No seat left — the invite form must be closed. */
  isFull: boolean;
}

/**
 * Seat arithmetic shared by Team & Roles and the setup wizard.
 *
 * A pending invitation consumes a seat: it has already been promised to
 * someone, and counting only accepted members is what let a company hand out
 * far more invitations than it had room for.
 */
export function getSeatUsage(
  plan: PlanKey | null | undefined,
  activeMembers: number,
  pendingInvites: number
): SeatUsage {
  const limit = getPlanUserLimit(plan);
  const used = activeMembers + pendingInvites;
  return {
    activeMembers,
    pendingInvites,
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    isFull: limit !== null && used >= limit,
  };
}
