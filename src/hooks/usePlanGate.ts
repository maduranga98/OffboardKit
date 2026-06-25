import { useCompanyStore } from "../store/companyStore";

export function usePlanGate() {
  const company = useCompanyStore((s) => s.company);

  const planOrder = ["basic", "starter", "growth", "business", "enterprise"];

  const requiresPlan = (
    minPlan: "starter" | "growth" | "business" | "enterprise"
  ): boolean => {
    return (
      planOrder.indexOf(company?.plan ?? "basic") >= planOrder.indexOf(minPlan)
    );
  };

  // ── Core Offboarding ──────────────────────────────────────────────────────

  const canStartOffboarding = (): { allowed: boolean; reason?: string } => {
    if (!company) return { allowed: false, reason: "no_company" };
    if (
      company.plan === "basic" &&
      (company.usageCount?.offboardingsThisYear ?? 0) >= 3
    ) {
      return { allowed: false, reason: "basic_limit" };
    }
    return { allowed: true };
  };

  const canUseUnlimitedTemplates = (): boolean => requiresPlan("growth");

  const canRemoveBranding = (): boolean => requiresPlan("starter");

  // ── Knowledge Transfer ────────────────────────────────────────────────────

  const canUseAiQACapture = (): boolean => requiresPlan("starter");

  const canUseVideoUpload = (): boolean => requiresPlan("growth");

  const canUseFullTextSearch = (): boolean => requiresPlan("growth");

  const canUseKnowledgeThreads = (): boolean => requiresPlan("growth");

  const canUseKnowledgePdfExport = (): boolean => requiresPlan("growth");

  // AI gap detection: requires growth+ AND the feature flag must not be
  // explicitly disabled at the company level (allows per-company overrides).
  const canUseAiGapDetection = (): boolean => {
    if (!requiresPlan("growth")) return false;
    if (company?.features?.aiGapDetection === false) return false;
    return true;
  };

  // ── Asset Management ──────────────────────────────────────────────────────

  const canUseAssetManagement = (): boolean => requiresPlan("starter");

  const canUseDataWiping = (): boolean => requiresPlan("growth");

  // ── Access Revocation ─────────────────────────────────────────────────────

  const canUseAccessRevocation = (): boolean => requiresPlan("starter");

  const canUseCustomAccessSystems = (): boolean => requiresPlan("growth");

  const canUseComplianceExport = (): boolean => requiresPlan("business");

  // ── Exit Interviews ───────────────────────────────────────────────────────

  const canUseExitInterviews = (): boolean => requiresPlan("starter");

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

  const canUseFullAlumniPortal = (): boolean => requiresPlan("business");

  const canUseBoomerangPipeline = (): boolean => requiresPlan("growth");

  const canUseFullBoomerangPipeline = (): boolean => requiresPlan("business");

  const canUseJobBoard = (): boolean => requiresPlan("growth");

  const canUseJobBoardAudienceTargeting = (): boolean => requiresPlan("business");

  // Pulse surveys move to Business+ in the new plan structure.
  const canUsePulseSurveys = (): boolean => requiresPlan("business");

  const canUseScheduledPulseSurveys = (): boolean => requiresPlan("business");

  const canUseReEngagementScore = (): boolean => requiresPlan("growth");

  const canUseAskTheExpert = (): boolean => requiresPlan("business");

  const canUseConsultingPool = (): boolean => requiresPlan("business");

  const canUseReferenceLetters = (): boolean => requiresPlan("growth");

  // ── Analytics ─────────────────────────────────────────────────────────────

  const canUseAnalytics = (): boolean => requiresPlan("starter");

  const canUseAllTimeAnalytics = (): boolean => requiresPlan("growth");

  const canUseCsvExport = (): boolean => requiresPlan("growth");

  const canUseHistoricalTrends = (): boolean => requiresPlan("business");

  const canUseScheduledReports = (): boolean => requiresPlan("business");

  const canUseAuditExport = (): boolean => requiresPlan("business");

  // ── Admin & Security ──────────────────────────────────────────────────────

  const canUseCustomEmailTemplates = (): boolean => requiresPlan("business");

  const canUseSSO = (): boolean => requiresPlan("enterprise");

  const canUseWhiteLabel = (): boolean => requiresPlan("enterprise");

  return {
    // plan info
    plan: company?.plan ?? "basic",
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
    canUseKnowledgeThreads,
    canUseKnowledgePdfExport,
    canUseAiGapDetection,

    // asset management
    canUseAssetManagement,
    canUseDataWiping,

    // access revocation
    canUseAccessRevocation,
    canUseCustomAccessSystems,
    canUseComplianceExport,

    // exit interviews
    canUseExitInterviews,
    canUseCustomExitInterview,
    canUseAdvancedExitInterview,
    canUseAiSentiment,
    canUseAdvancedExitAnalytics,

    // alumni portal
    canUseAlumniPortal,
    canUseFullAlumniPortal,
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
    canUseHistoricalTrends,
    canUseScheduledReports,
    canUseAuditExport,

    // admin
    canUseCustomEmailTemplates,
    canUseSSO,
    canUseWhiteLabel,
  };
}
