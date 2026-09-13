import * as admin from "firebase-admin";

/**
 * Seat limits, server side.
 *
 * Every package sells a fixed number of *user accounts* (the owner included).
 * Until now that number lived only in src/lib/plans.ts as marketing copy, so
 * nothing enforced it: Team & Roles would send as many invitations as you
 * typed, each invitee registered fine, and the seat count in the price list
 * meant nothing.
 *
 * The limit is applied where the seat is actually handed out — when the
 * invitation is created — rather than at login or acceptance. An invitation
 * that was sent is a promise; refusing it at the door leaves a person with a
 * working account that cannot get in, which is exactly the bug this fixes.
 * So a seat is consumed by an active member OR by a pending invitation, and
 * the company simply cannot send the invitation that would overshoot.
 *
 * Mirrors PLAN_CONFIG[*].userLimit in src/lib/plans.ts — the two must agree,
 * and this copy is the authority.
 */

/** Seats per package. null = unlimited (Enterprise). */
export const PLAN_USER_LIMITS: Record<string, number | null> = {
  basic: 1,
  starter: 3,
  growth: 10,
  business: 25,
  enterprise: null,
};

/** Fallback for a company whose plan field is missing or unrecognised. */
const DEFAULT_PLAN = "basic";

type CompanyData = admin.firestore.DocumentData | undefined;

/**
 * The package a company may actually use right now.
 *
 * Mirrors getEffectivePlan in src/lib/trial.ts: a trial that has run out
 * falls back to Basic immediately rather than waiting for the hourly
 * expireTrials sweep to rewrite the document, so seats close at the same
 * instant features do.
 */
export function getEffectivePlan(company: CompanyData, now: Date = new Date()): string {
  if (!company) return DEFAULT_PLAN;

  if (company.trialStatus === "active") {
    const endsAt = company.trialEndsAt as admin.firestore.Timestamp | undefined;
    if (endsAt && endsAt.toMillis() <= now.getTime()) return DEFAULT_PLAN;
  }

  const plan = company.plan as string | undefined;
  return plan && plan in PLAN_USER_LIMITS ? plan : DEFAULT_PLAN;
}

/** Seats the company's current package allows. null = unlimited. */
export function getPlanUserLimit(
  company: CompanyData,
  now: Date = new Date()
): number | null {
  return PLAN_USER_LIMITS[getEffectivePlan(company, now)] ?? null;
}

export interface SeatUsage {
  /** Member accounts attached to the company that are not deactivated. */
  activeMembers: number;
  /** Unexpired invitations still waiting to be accepted. */
  pendingInvites: number;
  /** activeMembers + pendingInvites — what counts against the limit. */
  used: number;
  /** Seats the package allows; null = unlimited. */
  limit: number | null;
  /** Seats left, or null when unlimited. Never negative. */
  remaining: number | null;
}

/**
 * Counts the seats a company is holding.
 *
 * A pending invitation counts: it is a seat already promised to someone, and
 * not counting it would let an admin queue twenty invitations against three
 * seats and only discover the problem once people started registering.
 * Expired and already-accepted invitations release their seat, since nobody
 * can use them.
 */
export async function getSeatUsage(
  companyId: string,
  company: CompanyData,
  now: Date = new Date()
): Promise<SeatUsage> {
  const db = admin.firestore();

  const [memberSnap, inviteSnap] = await Promise.all([
    db.collection("users").where("companyId", "==", companyId).get(),
    db
      .collection("invites")
      .where("companyId", "==", companyId)
      .where("status", "==", "pending")
      .get(),
  ]);

  const activeMembers = memberSnap.docs.filter(
    (doc) => doc.data().isActive !== false
  ).length;

  const pendingInvites = inviteSnap.docs.filter((doc) => {
    const expiresAt = doc.data().expiresAt as admin.firestore.Timestamp | undefined;
    return !expiresAt || expiresAt.toMillis() > now.getTime();
  }).length;

  const limit = getPlanUserLimit(company, now);
  const used = activeMembers + pendingInvites;

  return {
    activeMembers,
    pendingInvites,
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
  };
}
