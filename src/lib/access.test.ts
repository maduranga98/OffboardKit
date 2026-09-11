import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase/firestore";
import { getAccessState, hasEntitledSubscription } from "./access";
import type { Company } from "../types/company.types";

const NOW = new Date("2026-03-10T12:00:00Z");

function company(overrides: Partial<Company>): Company {
  return { id: "c1", name: "Acme", plan: "basic", ...overrides } as Company;
}

function inDays(days: number): Timestamp {
  return Timestamp.fromDate(new Date(NOW.getTime() + days * 86400000));
}

describe("hasEntitledSubscription", () => {
  it.each(["active", "trialing", "past_due"])("accepts %s", (status) => {
    expect(
      hasEntitledSubscription(
        company({ stripeSubscriptionId: "sub_1", stripeSubscriptionStatus: status })
      )
    ).toBe(true);
  });

  it.each(["canceled", "unpaid", "incomplete_expired"])("rejects %s", (status) => {
    expect(
      hasEntitledSubscription(
        company({ stripeSubscriptionId: "sub_1", stripeSubscriptionStatus: status })
      )
    ).toBe(false);
  });

  it("rejects a status with no subscription behind it", () => {
    expect(
      hasEntitledSubscription(company({ stripeSubscriptionStatus: "active" }))
    ).toBe(false);
  });
});

describe("getAccessState", () => {
  it("keeps a running trial unlocked", () => {
    const state = getAccessState(
      company({ plan: "starter", trialStatus: "active", trialEndsAt: inDays(3) }),
      NOW
    );
    expect(state.status).toBe("trialing");
    expect(state.isLocked).toBe(false);
    expect(state.entitledPlan).toBe("starter");
  });

  it("locks the moment the window closes, before the sweep runs", () => {
    const state = getAccessState(
      company({ plan: "starter", trialStatus: "active", trialEndsAt: inDays(-0.001) }),
      NOW
    );
    expect(state.status).toBe("locked");
    expect(state.isLocked).toBe(true);
    expect(state.lockedAfterTrial).toBe(true);
    expect(state.entitledPlan).toBeNull();
  });

  it("locks a swept trial that never converted", () => {
    const state = getAccessState(
      company({ plan: "basic", trialStatus: "expired", trialEndsAt: inDays(-2) }),
      NOW
    );
    expect(state.isLocked).toBe(true);
    expect(state.lockedAfterTrial).toBe(true);
  });

  it("does not lock a company that subscribed during its trial", () => {
    const state = getAccessState(
      company({
        plan: "growth",
        trialStatus: "converted",
        trialEndsAt: inDays(-2),
        stripeSubscriptionId: "sub_1",
        stripeSubscriptionStatus: "active",
      }),
      NOW
    );
    expect(state.status).toBe("subscribed");
    expect(state.entitledPlan).toBe("growth");
  });

  it("keeps a past_due subscriber unlocked while Stripe retries the card", () => {
    const state = getAccessState(
      company({
        plan: "growth",
        trialStatus: "converted",
        stripeSubscriptionId: "sub_1",
        stripeSubscriptionStatus: "past_due",
      }),
      NOW
    );
    expect(state.isLocked).toBe(false);
  });

  it("locks a cancelled subscriber, and does not blame the trial", () => {
    const state = getAccessState(
      company({
        plan: "basic",
        trialStatus: "converted",
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: "canceled",
      }),
      NOW
    );
    expect(state.isLocked).toBe(true);
    expect(state.lockedAfterTrial).toBe(false);
  });

  it("leaves a company that predates trials alone", () => {
    const state = getAccessState(company({ plan: "growth" }), NOW);
    expect(state.status).toBe("legacy");
    expect(state.isLocked).toBe(false);
  });

  it("does not treat an abandoned checkout as a billing relationship", () => {
    // createCheckoutSession writes stripeCustomerId before any payment.
    const state = getAccessState(
      company({ plan: "growth", stripeCustomerId: "cus_1" }),
      NOW
    );
    expect(state.isLocked).toBe(false);
  });

  it("never locks before a company is loaded", () => {
    expect(getAccessState(null, NOW).isLocked).toBe(false);
  });
});
