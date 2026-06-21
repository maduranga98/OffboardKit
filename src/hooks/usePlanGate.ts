import { useCompanyStore } from "../store/companyStore";

export function usePlanGate() {
  const company = useCompanyStore((s) => s.company);

  const planOrder = ["free", "starter", "growth", "business", "enterprise"];

  const requiresPlan = (
    minPlan: "starter" | "growth" | "business" | "enterprise"
  ): boolean => {
    return (
      planOrder.indexOf(company?.plan ?? "free") >= planOrder.indexOf(minPlan)
    );
  };

  // ── Core Offboarding ──────────────────────────────────────────────────────

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

  const canUseUnlimitedTemplates = (): boolean => requiresPlan("growth");

  const canRemoveBranding = (): boolean => requiresPlan("starter");

  // ── Knowledge Transfer ────────────────────────────────────────────────────

  const canUseAiQACapture = (): boolean => requiresPlan("starter");

  const canUseVideoUpload = (): boolean => requiresPlan("growth");

  const canUseFullTextSearch = (): boolean => requiresPlan("growth");

  // AI gap detection: requires business+ AND the feature flag must not be
  // explicitly disabled at the company level (allows per-company overrides)
  const canUseAiGapDetection = (): boolean => {
    if (!requiresPlan("business")) return false;
    if (company?.features?.aiGapDetection === false) return false;
    return true;
  };

  // ── Access Revocation ─────────────────────────────────────────────────────

  const canUseAccessRevocation = (): boolean => requiresPlan("starter");

  const canUseComplianceExport = (): boolean => requiresPlan("business");

  // ── Exit Interviews ───────────────────────────────────────────────────────

  const canUseCustomExitInterview = (): boolean => requiresPlan("growth");

  const canUseAdvancedExitInterview = (): boolean => requiresPlan("business");

  const canUseAiSentiment = (): boolean => requiresPlan("growth");

  const canUseAdvancedExitAnalytics = (): boolean => requiresPlan("business");

  // ── Alumni Portal ─────────────────────────────────────────────────────────

  const canUseAlumniPortal = (): boolean => {
    if (!requiresPlan("growth")) return false;
    if (company?.features?.alumniPortal === false) return false;
    return true;
  };

  const canUseBoomerangPipeline = (): boolean => requiresPlan("growth");

  const canUseFullBoomerangPipeline = (): boolean => requiresPlan("business");

  const canUseJobBoard = (): boolean => requiresPlan("growth");

  const canUseJobBoardAudienceTargeting = (): boolean => requiresPlan("business");

  const canUsePulseSurveys = (): boolean => requiresPlan("growth");

  const canUseScheduledPulseSurveys = (): boolean => requiresPlan("business");

  const canUseReEngagementScore = (): boolean => requiresPlan("growth");

  const canUseAskTheExpert = (): boolean => requiresPlan("business");

  const canUseConsultingPool = (): boolean => requiresPlan("business");

  const canUseReferenceLetters = (): boolean => requiresPlan("business");

  // ── Analytics ─────────────────────────────────────────────────────────────

  const canUseAnalytics = (): boolean => requiresPlan("starter");

  const canUseAllTimeAnalytics = (): boolean => requiresPlan("growth");

  const canUseCsvExport = (): boolean => requiresPlan("growth");

  const canUseScheduledReports = (): boolean => requiresPlan("business");

  // ── Admin & Security ──────────────────────────────────────────────────────

  const canUseCustomEmailTemplates = (): boolean => requiresPlan("business");

  const canUseSSO = (): boolean => requiresPlan("enterprise");

  const canUseWhiteLabel = (): boolean => requiresPlan("enterprise");

  return {
    // plan info
    plan: company?.plan ?? "free",
    features: company?.features ?? null,
    requiresPlan,

    // core
    canStartOffboarding,
    canUseUnlimitedTemplates,
    canRemoveBranding,

    // knowledge transfer
    canUseAiQACapture,
    canUseVideoUpload,
    canUseFullTextSearch,
    canUseAiGapDetection,

    // access revocation
    canUseAccessRevocation,
    canUseComplianceExport,

    // exit interviews
    canUseCustomExitInterview,
    canUseAdvancedExitInterview,
    canUseAiSentiment,
    canUseAdvancedExitAnalytics,

    // alumni portal
    canUseAlumniPortal,
    canUseBoomerangPipeline,
    canUseFullBoomerangPipeline,
    canUseJobBoard,
    canUseJobBoardAudienceTargeting,
    canUsePulseSurveys,
    canUseScheduledPulseSurveys,
    canUseReEngagementScore,
    canUseAskTheExpert,
    canUseConsultingPool,
    canUseReferenceLetters,

    // analytics
    canUseAnalytics,
    canUseAllTimeAnalytics,
    canUseCsvExport,
    canUseScheduledReports,

    // admin
    canUseCustomEmailTemplates,
    canUseSSO,
    canUseWhiteLabel,
  };
}
