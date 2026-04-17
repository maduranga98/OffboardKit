import { useCompanyStore } from "../store/companyStore";

export function usePlanGate() {
  const company = useCompanyStore((s) => s.company);

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

  const requiresPlan = (
    minPlan: "starter" | "growth" | "business"
  ): boolean => {
    const order = ["free", "starter", "growth", "business", "enterprise"];
    return (
      order.indexOf(company?.plan ?? "free") >= order.indexOf(minPlan)
    );
  };

  return { canStartOffboarding, requiresPlan, plan: company?.plan ?? "free" };
}
