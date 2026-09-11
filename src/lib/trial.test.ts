import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase/firestore";
import { getEffectivePlan, getTrialState, TRIAL_DAYS } from "./trial";
import type { Company } from "../types/company.types";

const NOW = new Date("2026-03-10T12:00:00Z");

function company(overrides: Partial<Company>): Company {
  return { id: "c1", name: "Acme", plan: "basic", ...overrides } as Company;
}

function inDays(days: number): Timestamp {
  return Timestamp.fromDate(
    new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000)
  );
}

describe("getTrialState", () => {
  it("reports a running trial with days remaining", () => {
    const state = getTrialState(
      company({ plan: "starter", trialStatus: "active", trialEndsAt: inDays(3) }),
      NOW
    );
    expect(state.isActive).toBe(true);
    expect(state.hasExpired).toBe(false);
    expect(state.daysRemaining).toBe(3);
  });

  it("rounds a part-day up so the last day still reads as 1", () => {
    const state = getTrialState(
      company({ plan: "starter", trialStatus: "active", trialEndsAt: inDays(0.25) }),
      NOW
    );
    expect(state.daysRemaining).toBe(1);
  });

  it("treats a lapsed window as expired even before the sweep runs", () => {
    const state = getTrialState(
      company({ plan: "starter", trialStatus: "active", trialEndsAt: inDays(-1) }),
      NOW
    );
    expect(state.isActive).toBe(false);
    expect(state.hasExpired).toBe(true);
    expect(state.daysRemaining).toBe(0);
  });

  it("reports a swept trial as expired", () => {
    const state = getTrialState(
      company({ plan: "basic", trialStatus: "expired", trialEndsAt: inDays(-5) }),
      NOW
    );
    expect(state.hasExpired).toBe(true);
  });

  it("is inert for a company that converted to a paid plan", () => {
    const state = getTrialState(
      company({ plan: "growth", trialStatus: "converted", trialEndsAt: inDays(-2) }),
      NOW
    );
    expect(state.isActive).toBe(false);
    expect(state.hasExpired).toBe(false);
  });

  it("is inert for a company that never had a trial", () => {
    const state = getTrialState(company({ plan: "basic" }), NOW);
    expect(state.isActive).toBe(false);
    expect(state.hasExpired).toBe(false);
  });

  it("grants a full window of TRIAL_DAYS", () => {
    const state = getTrialState(
      company({
        plan: "starter",
        trialStatus: "active",
        trialEndsAt: inDays(TRIAL_DAYS),
      }),
      NOW
    );
    expect(state.daysRemaining).toBe(TRIAL_DAYS);
  });
});

describe("getEffectivePlan", () => {
  it("grants starter for the length of the trial", () => {
    expect(
      getEffectivePlan(
        company({ plan: "starter", trialStatus: "active", trialEndsAt: inDays(1) }),
        NOW
      )
    ).toBe("starter");
  });

  it("drops to basic the moment the window closes, ahead of the sweep", () => {
    expect(
      getEffectivePlan(
        company({
          plan: "starter",
          trialStatus: "active",
          trialEndsAt: inDays(-0.01),
        }),
        NOW
      )
    ).toBe("basic");
  });

  it("never downgrades a paying company whose trial converted", () => {
    expect(
      getEffectivePlan(
        company({
          plan: "business",
          trialStatus: "converted",
          trialEndsAt: inDays(-30),
        }),
        NOW
      )
    ).toBe("business");
  });

  it("defaults to basic with no company loaded", () => {
    expect(getEffectivePlan(null, NOW)).toBe("basic");
  });
});
