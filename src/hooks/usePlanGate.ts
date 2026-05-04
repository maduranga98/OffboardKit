import { useCompanyStore } from "../store/companyStore";

export function usePlanGate() {
  const company = useCompanyStore((s) => s.company);

  const planOrder = ["free", "starter", "growth", "business", "enterprise"];

  const requiresPlan = (
    minPlan: "starter" | "growth" | "business"
  ): boolean => {
    return (
      planOrder.indexOf(company?.plan ?? "free") >= planOrder.indexOf(minPlan)
    );
  };

  const canStartOffboarding = (): { allowed: boolean; reason?: string } => {
    if (!company) return { allowed: false, reason: "no_company" };
    if (
      company.plan === "free" &&
      (company.usageCount?.offboardingsThisYear ?? 0) >= 3
    ) {
      return { allowed: false, reason: "free_limit" };
    }
    return { allowed: true };
  };

  // AI gap detection: requires growth+ plan AND the feature flag must not be
  // explicitly disabled at the company level (allows per-company overrides)
  const canUseAiGapDetection = (): boolean => {
    if (!requiresPlan("growth")) return false;
    if (company?.features?.aiGapDetection === false) return false;
    return true;
  };

  // AI sentiment analysis follows the same plan gate
  const canUseAiSentiment = (): boolean => {
    return requiresPlan("growth");
  };

  return {
    canStartOffboarding,
    requiresPlan,
    canUseAiGapDetection,
    canUseAiSentiment,
    plan: company?.plan ?? "free",
    features: company?.features ?? null,
  };
}

