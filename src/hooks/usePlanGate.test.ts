import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import { useCompanyStore } from "../store/companyStore";
import { usePlanGate } from "./usePlanGate";
import type { Company } from "../types/company.types";

function setCompany(overrides: Partial<Company>) {
  useCompanyStore.setState({
    company: {
      id: "c1",
      name: "Acme",
      plan: "basic",
      features: {
        knowledgeVideo: false,
        alumniPortal: false,
        aiGapDetection: true,
        apiAccess: false,
      },
      usageCount: { offboardingsThisYear: 0, activeOffboardings: 0 },
      ...overrides,
    } as unknown as Company,
    loading: false,
  });
}

describe("usePlanGate", () => {
  beforeEach(() => {
    useCompanyStore.setState({ company: null, loading: false });
  });

  it("defaults to plan=basic when no company is loaded", () => {
    const { result } = renderHook(() => usePlanGate());
    expect(result.current.plan).toBe("basic");
    expect(result.current.requiresPlan("starter")).toBe(false);
  });

  it("requiresPlan respects the basic→enterprise ordering", () => {
    setCompany({ plan: "growth" });
    const { result } = renderHook(() => usePlanGate());
    expect(result.current.requiresPlan("starter")).toBe(true);
    expect(result.current.requiresPlan("growth")).toBe(true);
    expect(result.current.requiresPlan("business")).toBe(false);
  });

  describe("canStartOffboarding", () => {
    it("returns no_company when company is missing", () => {
      const { result } = renderHook(() => usePlanGate());
      expect(result.current.canStartOffboarding()).toEqual({
        allowed: false,
        reason: "no_company",
      });
    });

    it("basic plan can start the first three of the year", () => {
      setCompany({
        plan: "basic",
        usageCount: { offboardingsThisYear: 2, activeOffboardings: 0 },
      });
      const { result } = renderHook(() => usePlanGate());
      expect(result.current.canStartOffboarding()).toEqual({ allowed: true });
    });

    it("basic plan is blocked at the three-per-year cap", () => {
      setCompany({
        plan: "basic",
        usageCount: { offboardingsThisYear: 3, activeOffboardings: 0 },
      });
      const { result } = renderHook(() => usePlanGate());
      expect(result.current.canStartOffboarding()).toEqual({
        allowed: false,
        reason: "basic_limit",
      });
    });

    it("paid plans bypass the free cap regardless of usage", () => {
      setCompany({
        plan: "starter",
        usageCount: { offboardingsThisYear: 999, activeOffboardings: 0 },
      });
      const { result } = renderHook(() => usePlanGate());
      expect(result.current.canStartOffboarding()).toEqual({ allowed: true });
    });
  });

  describe("AI feature gates", () => {
    it("blocks AI gap detection below growth even if the flag is on", () => {
      setCompany({
        plan: "starter",
        features: {
          knowledgeVideo: false,
          alumniPortal: false,
          aiGapDetection: true,
          apiAccess: false,
        },
      });
      const { result } = renderHook(() => usePlanGate());
      expect(result.current.canUseAiGapDetection()).toBe(false);
    });

    it("respects a per-company aiGapDetection=false override on growth+", () => {
      setCompany({
        plan: "growth",
        features: {
          knowledgeVideo: false,
          alumniPortal: false,
          aiGapDetection: false,
          apiAccess: false,
        },
      });
      const { result } = renderHook(() => usePlanGate());
      expect(result.current.canUseAiGapDetection()).toBe(false);
    });

    it("allows AI gap detection on growth+ with the flag enabled", () => {
      setCompany({ plan: "growth" });
      const { result } = renderHook(() => usePlanGate());
      expect(result.current.canUseAiGapDetection()).toBe(true);
    });

    it("AI sentiment is gated purely on plan tier", () => {
      setCompany({ plan: "starter" });
      expect(renderHook(() => usePlanGate()).result.current.canUseAiSentiment()).toBe(false);
      setCompany({ plan: "growth" });
      expect(renderHook(() => usePlanGate()).result.current.canUseAiSentiment()).toBe(true);
    });
  });
});

describe("usePlanGate — trial", () => {
  beforeEach(() => {
    useCompanyStore.setState({ company: null, loading: false });
  });

  const at = (days: number) => ({
    toDate: () => new Date(Date.now() + days * 86_400_000),
  });

  it("unlocks Starter features while the trial runs", () => {
    setCompany({
      plan: "starter",
      trialStatus: "active",
      trialEndsAt: at(3) as never,
    });
    const { result } = renderHook(() => usePlanGate());
    expect(result.current.plan).toBe("starter");
    expect(result.current.requiresPlan("starter")).toBe(true);
    expect(result.current.requiresPlan("growth")).toBe(false);
    expect(result.current.trial.isActive).toBe(true);
  });

  it("locks Starter features once the window closes, before the sweep runs", () => {
    setCompany({
      plan: "starter",
      trialStatus: "active",
      trialEndsAt: at(-1) as never,
    });
    const { result } = renderHook(() => usePlanGate());
    expect(result.current.plan).toBe("basic");
    expect(result.current.requiresPlan("starter")).toBe(false);
    expect(result.current.trial.hasExpired).toBe(true);
  });

  // A lapsed trial no longer falls back to Basic: Basic is a paid plan, so a
  // company that never subscribed is locked out entirely.
  it("blocks a company whose trial lapsed, whatever its usage", () => {
    setCompany({
      plan: "starter",
      trialStatus: "active",
      trialEndsAt: at(-1) as never,
      usageCount: { offboardingsThisYear: 0, activeOffboardings: 0 },
    });
    const { result } = renderHook(() => usePlanGate());
    expect(result.current.canStartOffboarding()).toEqual({
      allowed: false,
      reason: "subscription_required",
    });
  });

  it("does not cap a company still inside its trial", () => {
    setCompany({
      plan: "starter",
      trialStatus: "active",
      trialEndsAt: at(2) as never,
      usageCount: { offboardingsThisYear: 9, activeOffboardings: 0 },
    });
    const { result } = renderHook(() => usePlanGate());
    expect(result.current.canStartOffboarding().allowed).toBe(true);
  });
});

describe("subscription lock", () => {
  function lockedCompany() {
    setCompany({
      plan: "growth",
      trialStatus: "expired",
      trialEndsAt: Timestamp.fromDate(new Date(Date.now() - 86400000)),
    });
  }

  it("reports the lock", () => {
    lockedCompany();
    const { result } = renderHook(() => usePlanGate());
    expect(result.current.isLocked).toBe(true);
  });

  it("closes every feature gate regardless of the stored plan", () => {
    lockedCompany();
    const { result } = renderHook(() => usePlanGate());
    expect(result.current.requiresPlan("starter")).toBe(false);
    expect(result.current.canUseAnalytics()).toBe(false);
    expect(result.current.canUseAssetManagement()).toBe(false);
    expect(result.current.canUseAlumniPortal()).toBe(false);
  });

  it("blocks new offboardings with a subscription_required reason", () => {
    lockedCompany();
    const { result } = renderHook(() => usePlanGate());
    expect(result.current.canStartOffboarding()).toEqual({
      allowed: false,
      reason: "subscription_required",
    });
  });

  it("leaves a paying company untouched", () => {
    setCompany({
      plan: "growth",
      trialStatus: "converted",
      stripeSubscriptionId: "sub_1",
      stripeSubscriptionStatus: "active",
    });
    const { result } = renderHook(() => usePlanGate());
    expect(result.current.isLocked).toBe(false);
    expect(result.current.canUseAnalytics()).toBe(true);
  });
});
