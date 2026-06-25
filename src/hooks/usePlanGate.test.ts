import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
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
