import { describe, it, expect } from "vitest";
import {
  PLAN_CONFIG,
  PLAN_ORDER,
  TRIALABLE_PLANS,
  isTrialablePlan,
} from "./plans";

describe("plan catalogue", () => {
  it("prices every plan it offers for trial", () => {
    for (const plan of TRIALABLE_PLANS) {
      expect(PLAN_CONFIG[plan].monthly).toBeGreaterThan(0);
      expect(PLAN_CONFIG[plan].annual).toBeGreaterThan(0);
    }
  });

  it("does not offer Enterprise for trial — it is quoted, not self-served", () => {
    expect(isTrialablePlan("enterprise")).toBe(false);
    expect(PLAN_CONFIG.enterprise.monthly).toBeNull();
  });

  it("rejects anything that is not a plan key", () => {
    expect(isTrialablePlan("free")).toBe(false);
    expect(isTrialablePlan("")).toBe(false);
    expect(isTrialablePlan(undefined)).toBe(false);
    expect(isTrialablePlan({ plan: "growth" })).toBe(false);
  });

  it("orders plans cheapest first", () => {
    const prices = PLAN_ORDER.filter((p) => p !== "enterprise").map(
      (p) => PLAN_CONFIG[p].monthly as number
    );
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it("covers every plan in the catalogue", () => {
    expect(Object.keys(PLAN_CONFIG).sort()).toEqual([...PLAN_ORDER].sort());
  });
});
