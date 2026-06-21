import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle,
  Zap,
  Mail,
  CreditCard,
  FileText,
  Users,
  BarChart2,
  Brain,
  Globe,
  Lock,
  X,
  Star,
  MessageCircle,
  GitBranch,
  Shield,
  Briefcase,
} from "lucide-react";
import { format } from "date-fns";
import { httpsCallable } from "firebase/functions";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import { getDocument } from "../../lib/firestore";
import { functions } from "../../lib/firebase";
import type { Company } from "../../types/company.types";
import { SettingsShell } from "./SettingsShell";

type PlanKey = "free" | "starter" | "growth" | "business" | "enterprise";
type BillingCycle = "monthly" | "annual";

const PLAN_CONFIG: Record<
  PlanKey,
  {
    label: string;
    emoji: string;
    tagline: string;
    monthly: number | null;
    annual: number | null;
    annualTotal: number | null;
    annualSaving: number | null;
    annualSavingPct: number | null;
    color: "mist" | "teal" | "navy" | "amber";
    userLimit: number | null;
    employeeLimit: number | null;
    exitLimit: number | null;
    popular?: boolean;
  }
> = {
  free: {
    label: "Free", emoji: "🆓", tagline: "Try before you commit",
    monthly: 0, annual: 0, annualTotal: 0, annualSaving: 0, annualSavingPct: null,
    color: "mist", userLimit: 1, employeeLimit: null, exitLimit: 3,
  },
  starter: {
    label: "Starter", emoji: "💼", tagline: "Unlimited offboarding for small teams",
    monthly: 29, annual: 24, annualTotal: 290, annualSaving: 58, annualSavingPct: 16,
    color: "teal", userLimit: 3, employeeLimit: 50, exitLimit: null,
  },
  growth: {
    label: "Growth", emoji: "🚀", tagline: "Complete platform for growing teams",
    monthly: 79, annual: 66, annualTotal: 790, annualSaving: 158, annualSavingPct: 16,
    color: "teal", userLimit: 10, employeeLimit: 200, exitLimit: null, popular: true,
  },
  business: {
    label: "Business", emoji: "🏢", tagline: "Advanced AI + full alumni tools",
    monthly: 199, annual: 166, annualTotal: 1990, annualSaving: 398, annualSavingPct: 16,
    color: "navy", userLimit: 25, employeeLimit: 500, exitLimit: null,
  },
  enterprise: {
    label: "Enterprise", emoji: "🏛️", tagline: "White-label, SSO & compliance",
    monthly: null, annual: null, annualTotal: null, annualSaving: null, annualSavingPct: null,
    color: "amber", userLimit: null, employeeLimit: null, exitLimit: null,
  },
};

interface PlanFeatures {
  // Core
  offboardings: string;
  templates: string;
  users: string;
  employees: string;
  taskRouting: boolean;
  removeBranding: boolean;
  // Knowledge Transfer
  documentUpload: boolean;
  aiQACapture: boolean;
  videoUpload: boolean;
  fullTextSearch: boolean;
  aiGapDetection: boolean;
  // Access Revocation
  accessRevocation: boolean;
  complianceExport: boolean;
  // Exit Interviews
  exitInterviews: string;
  aiSentiment: boolean;
  advancedExitAnalytics: boolean;
  // Alumni
  alumniDirectory: string;
  boomerangPipeline: string;
  jobBoard: boolean;
  pulseSurveys: string;
  reEngagementScore: boolean;
  askTheExpert: boolean;
  consultingPool: boolean;
  referenceLetters: boolean;
  // Analytics
  analyticsDashboard: string;
  csvExport: boolean;
  scheduledReports: boolean;
  // Admin
  sso: boolean;
  sla: boolean;
  dedicatedManager: boolean;
  // Support
  support: string;
}

const PLAN_FEATURES: Record<PlanKey, PlanFeatures> = {
  free: {
    offboardings: "3 / year",
    templates: "1",
    users: "1 HR user",
    employees: "—",
    taskRouting: false,
    removeBranding: false,
    documentUpload: true,
    aiQACapture: false,
    videoUpload: false,
    fullTextSearch: false,
    aiGapDetection: false,
    accessRevocation: false,
    complianceExport: false,
    exitInterviews: "—",
    aiSentiment: false,
    advancedExitAnalytics: false,
    alumniDirectory: "—",
    boomerangPipeline: "—",
    jobBoard: false,
    pulseSurveys: "—",
    reEngagementScore: false,
    askTheExpert: false,
    consultingPool: false,
    referenceLetters: false,
    analyticsDashboard: "—",
    csvExport: false,
    scheduledReports: false,
    sso: false,
    sla: false,
    dedicatedManager: false,
    support: "Email (72h)",
  },
  starter: {
    offboardings: "Unlimited",
    templates: "5",
    users: "3 HR users",
    employees: "Up to 50",
    taskRouting: true,
    removeBranding: true,
    documentUpload: true,
    aiQACapture: true,
    videoUpload: false,
    fullTextSearch: false,
    aiGapDetection: false,
    accessRevocation: true,
    complianceExport: false,
    exitInterviews: "Fixed template",
    aiSentiment: false,
    advancedExitAnalytics: false,
    alumniDirectory: "View-only",
    boomerangPipeline: "—",
    jobBoard: false,
    pulseSurveys: "—",
    reEngagementScore: false,
    askTheExpert: false,
    consultingPool: false,
    referenceLetters: false,
    analyticsDashboard: "90 days",
    csvExport: false,
    scheduledReports: false,
    sso: false,
    sla: false,
    dedicatedManager: false,
    support: "Email (48h)",
  },
  growth: {
    offboardings: "Unlimited",
    templates: "Unlimited",
    users: "10 HR users",
    employees: "Up to 200",
    taskRouting: true,
    removeBranding: true,
    documentUpload: true,
    aiQACapture: true,
    videoUpload: true,
    fullTextSearch: true,
    aiGapDetection: false,
    accessRevocation: true,
    complianceExport: false,
    exitInterviews: "Custom builder",
    aiSentiment: true,
    advancedExitAnalytics: false,
    alumniDirectory: "Full + profiles",
    boomerangPipeline: "2 stages",
    jobBoard: true,
    pulseSurveys: "Manual + basic",
    reEngagementScore: true,
    askTheExpert: false,
    consultingPool: false,
    referenceLetters: false,
    analyticsDashboard: "All time",
    csvExport: true,
    scheduledReports: false,
    sso: false,
    sla: false,
    dedicatedManager: false,
    support: "Priority email (24h)",
  },
  business: {
    offboardings: "Unlimited",
    templates: "Unlimited",
    users: "25 HR users",
    employees: "Up to 500",
    taskRouting: true,
    removeBranding: true,
    documentUpload: true,
    aiQACapture: true,
    videoUpload: true,
    fullTextSearch: true,
    aiGapDetection: true,
    accessRevocation: true,
    complianceExport: true,
    exitInterviews: "Advanced builder",
    aiSentiment: true,
    advancedExitAnalytics: true,
    alumniDirectory: "Full + profiles",
    boomerangPipeline: "4-stage Kanban",
    jobBoard: true,
    pulseSurveys: "Scheduled + analytics",
    reEngagementScore: true,
    askTheExpert: true,
    consultingPool: true,
    referenceLetters: true,
    analyticsDashboard: "All time",
    csvExport: true,
    scheduledReports: true,
    sso: false,
    sla: false,
    dedicatedManager: false,
    support: "Priority chat (8h)",
  },
  enterprise: {
    offboardings: "Unlimited",
    templates: "Unlimited",
    users: "Unlimited",
    employees: "Unlimited",
    taskRouting: true,
    removeBranding: true,
    documentUpload: true,
    aiQACapture: true,
    videoUpload: true,
    fullTextSearch: true,
    aiGapDetection: true,
    accessRevocation: true,
    complianceExport: true,
    exitInterviews: "Advanced builder",
    aiSentiment: true,
    advancedExitAnalytics: true,
    alumniDirectory: "Full + profiles",
    boomerangPipeline: "Full",
    jobBoard: true,
    pulseSurveys: "Full",
    reEngagementScore: true,
    askTheExpert: true,
    consultingPool: true,
    referenceLetters: true,
    analyticsDashboard: "All time",
    csvExport: true,
    scheduledReports: true,
    sso: true,
    sla: true,
    dedicatedManager: true,
    support: "Dedicated manager (4h)",
  },
};

type FeatureRowGroup = { group: string; rows: { key: keyof PlanFeatures; label: string; icon: React.ReactNode }[] };

const FEATURE_ROW_GROUPS: FeatureRowGroup[] = [
  {
    group: "Core Offboarding",
    rows: [
      { key: "offboardings", label: "Offboardings / year", icon: <FileText size={14} /> },
      { key: "templates", label: "Checklist templates", icon: <FileText size={14} /> },
      { key: "users", label: "HR / Manager users", icon: <Users size={14} /> },
      { key: "employees", label: "Employees in system", icon: <Users size={14} /> },
      { key: "taskRouting", label: "Task routing by dept.", icon: <CheckCircle size={14} /> },
      { key: "removeBranding", label: "Remove OffboardKit branding", icon: <Star size={14} /> },
    ],
  },
  {
    group: "Knowledge Transfer",
    rows: [
      { key: "documentUpload", label: "Document upload", icon: <FileText size={14} /> },
      { key: "aiQACapture", label: "AI-guided Q&A capture", icon: <Brain size={14} /> },
      { key: "videoUpload", label: "Video upload + link attach", icon: <FileText size={14} /> },
      { key: "fullTextSearch", label: "Full-text knowledge search", icon: <FileText size={14} /> },
      { key: "aiGapDetection", label: "AI knowledge gap detection", icon: <Brain size={14} /> },
    ],
  },
  {
    group: "Access Revocation",
    rows: [
      { key: "accessRevocation", label: "Access revocation tracker", icon: <Lock size={14} /> },
      { key: "complianceExport", label: "Compliance audit export (PDF)", icon: <Shield size={14} /> },
    ],
  },
  {
    group: "Exit Interviews",
    rows: [
      { key: "exitInterviews", label: "Exit interview", icon: <MessageCircle size={14} /> },
      { key: "aiSentiment", label: "AI sentiment analysis", icon: <Brain size={14} /> },
      { key: "advancedExitAnalytics", label: "Advanced analytics + benchmarking", icon: <BarChart2 size={14} /> },
    ],
  },
  {
    group: "Alumni Portal",
    rows: [
      { key: "alumniDirectory", label: "Alumni directory", icon: <Globe size={14} /> },
      { key: "boomerangPipeline", label: "Boomerang hire pipeline", icon: <GitBranch size={14} /> },
      { key: "jobBoard", label: "Job board + referral flow", icon: <Briefcase size={14} /> },
      { key: "pulseSurveys", label: "Pulse survey system", icon: <BarChart2 size={14} /> },
      { key: "reEngagementScore", label: "Re-engagement score", icon: <Zap size={14} /> },
      { key: "askTheExpert", label: "Ask the Expert threads", icon: <MessageCircle size={14} /> },
      { key: "consultingPool", label: "Consulting / gig requests", icon: <Users size={14} /> },
      { key: "referenceLetters", label: "Reference letter + verification PDF", icon: <FileText size={14} /> },
    ],
  },
  {
    group: "Analytics",
    rows: [
      { key: "analyticsDashboard", label: "Analytics dashboard", icon: <BarChart2 size={14} /> },
      { key: "csvExport", label: "CSV / PDF export", icon: <FileText size={14} /> },
      { key: "scheduledReports", label: "Scheduled analytics reports", icon: <BarChart2 size={14} /> },
    ],
  },
  {
    group: "Admin & Security",
    rows: [
      { key: "sso", label: "SSO / SAML login", icon: <Lock size={14} /> },
      { key: "sla", label: "SLA guarantee (99.9% uptime)", icon: <CheckCircle size={14} /> },
      { key: "dedicatedManager", label: "Dedicated account manager", icon: <Users size={14} /> },
    ],
  },
  {
    group: "Support",
    rows: [
      { key: "support", label: "Support channel + response", icon: <MessageCircle size={14} /> },
    ],
  },
];

function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="text-xs font-medium text-navy">{value}</span>;
  }
  return value ? (
    <CheckCircle size={16} className="text-teal mx-auto" />
  ) : (
    <X size={14} className="text-navy/20 mx-auto" />
  );
}

export default function BillingSettings() {
  const { companyId, appUser } = useAuth();
  const isSuperAdmin = appUser?.role === "super_admin";
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [subscribingPlan, setSubscribingPlan] = useState<PlanKey | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setLoading(true);
      try {
        const data = await getDocument<Company>("companies", companyId);
        if (data) setCompany(data);
      } catch {
        showToast("error", "Failed to load billing information");
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      showToast("success", "Payment successful! Refreshing your plan…");
      setSearchParams({}, { replace: true });
      // The Stripe webhook fires asynchronously — poll the company doc
      // every 2s for up to 30s so the UI reflects the new plan without
      // a manual refresh. Stop as soon as the plan changes.
      if (companyId) {
        const startedPlan = company?.plan;
        let attempts = 0;
        const interval = window.setInterval(async () => {
          attempts++;
          try {
            const data = await getDocument<Company>("companies", companyId);
            if (data) {
              setCompany(data);
              if (data.plan !== startedPlan) {
                window.clearInterval(interval);
                showToast("success", `You're now on the ${data.plan} plan.`);
              }
            }
          } catch (err) {
            console.error("Post-checkout refresh failed", err);
          }
          if (attempts >= 15) {
            window.clearInterval(interval);
          }
        }, 2000);
        return () => window.clearInterval(interval);
      }
    } else if (checkout === "canceled") {
      showToast("info", "Checkout canceled. No changes were made.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, companyId, company?.plan]);

  if (loading) {
    return (
      <Card>
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Card>
        <div className="text-center py-12">
          <p className="text-navy font-medium mb-2">Access Restricted</p>
          <p className="text-sm text-mist">Only Super Admins can view and manage billing.</p>
        </div>
      </Card>
    );
  }

  if (!company) {
    return (
      <Card>
        <div className="text-center py-12">
          <p className="text-mist">Unable to load billing information</p>
        </div>
      </Card>
    );
  }

  const currentPlan = (company.plan || "free") as PlanKey;
  const planConfig = PLAN_CONFIG[currentPlan] || PLAN_CONFIG.free;
  const usageCount = company.usageCount || { offboardingsThisYear: 0, activeOffboardings: 0 };
  const memberSince = company.createdAt?.toDate?.()
    ? format(company.createdAt.toDate(), "MMMM yyyy")
    : "Unknown";

  const annualSavingsPct = 16;

  const handleSubscribe = async (plan: PlanKey) => {
    if (!companyId) return;
    setSubscribingPlan(plan);
    try {
      const createSession = httpsCallable(functions, "createCheckoutSession");
      const result = await createSession({ plan, billingCycle });
      const { url } = result.data as { url: string | null };
      if (url) {
        window.location.href = url;
      } else {
        showToast("error", "Failed to start checkout");
      }
    } catch (err: any) {
      showToast("error", err.message || "Failed to start checkout");
    } finally {
      setSubscribingPlan(null);
    }
  };

  return (
    <SettingsShell title="Billing" description="Plans, usage, and billing history">
    <div className="space-y-8">
      {/* ── Current Plan Summary ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-mist uppercase tracking-wide">
                  Current Plan
                </span>
                <Badge variant={planConfig.color}>{planConfig.label}</Badge>
              </div>
              <div>
                <h2 className="text-3xl font-display text-navy">
                  {planConfig.monthly === 0
                    ? "Free"
                    : planConfig.monthly === null
                      ? "Custom"
                      : `$${billingCycle === "annual" ? planConfig.annual : planConfig.monthly}`}
                  {planConfig.monthly !== null && planConfig.monthly !== 0 && (
                    <span className="text-base font-normal text-mist ml-1">/mo</span>
                  )}
                </h2>
                {planConfig.monthly !== null && planConfig.monthly !== 0 && billingCycle === "annual" && (
                  <p className="text-xs text-teal mt-0.5">
                    Billed annually — save {annualSavingsPct}%
                  </p>
                )}
              </div>
              <p className="text-sm text-mist">Member since {memberSince}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal/10">
              <CreditCard size={22} className="text-teal" />
            </div>
          </div>

          {currentPlan === "free" && (
            <div className="mt-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-navy">Offboardings this year</span>
                  <span className="text-sm text-mist">
                    {usageCount.offboardingsThisYear} / {planConfig.exitLimit ?? 3}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-navy/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usageCount.offboardingsThisYear >= 3 ? "bg-ember" : "bg-teal"
                    }`}
                    style={{ width: `${Math.min((usageCount.offboardingsThisYear / (planConfig.exitLimit ?? 3)) * 100, 100)}%` }}
                  />
                </div>
              </div>
              {usageCount.offboardingsThisYear >= (planConfig.exitLimit ?? 3) && (
                <div className="flex items-start gap-3 rounded-lg bg-ember/5 border border-ember/20 p-3">
                  <Zap size={15} className="text-ember mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-ember">
                    Free tier limit reached. Upgrade to continue running offboardings.
                  </p>
                </div>
              )}
            </div>
          )}

          {currentPlan !== "free" && (
            <div className="mt-4 flex items-center gap-2 text-teal text-sm">
              <CheckCircle size={15} />
              <span>
                Unlimited offboardings
                {planConfig.employeeLimit ? ` · up to ${planConfig.employeeLimit} employees` : ""}
              </span>
            </div>
          )}
        </Card>

        {/* Usage Stats */}
        <Card>
          <h3 className="text-sm font-semibold text-navy mb-4">Usage</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-mist">Active offboardings</span>
              <span className="text-sm font-semibold text-navy">
                {usageCount.activeOffboardings ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-mist">This year</span>
              <span className="text-sm font-semibold text-navy">
                {usageCount.offboardingsThisYear ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-mist">HR users</span>
              <span className="text-sm font-semibold text-navy">
                {planConfig.userLimit ?? "∞"}
              </span>
            </div>
            <div className="pt-3 border-t border-navy/5">
              <p className="text-xs text-mist">
                Billing portal &amp; invoices coming soon
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Payment Method ── */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy/5">
              <CreditCard size={18} className="text-mist" />
            </div>
            <div>
              <p className="text-sm font-medium text-navy">Payment Method</p>
              <p className="text-xs text-mist mt-0.5">
                {company.stripeCustomerId ? "Managed via Stripe" : "No card on file"}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled={!company.stripeCustomerId}>
            {company.stripeCustomerId ? "Manage in Stripe" : "Add Card"}
          </Button>
        </div>
      </Card>

      {/* ── Invoice History ── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-navy">Invoice History</h3>
          <Button variant="ghost" size="sm" disabled>
            <FileText size={14} className="mr-1.5" />
            Download All
          </Button>
        </div>
        <div className="py-8 text-center text-sm text-mist border-t border-navy/5">
          No invoices yet. Billing starts when you upgrade to a paid plan.
        </div>
      </Card>

      {/* ── Plan Comparison ── */}
      <div id="available-plans" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-display text-navy">Plans</h3>
            <p className="text-sm text-mist mt-0.5">
              Choose a plan that fits your team. You can upgrade or downgrade anytime.
            </p>
          </div>
          {/* Billing cycle toggle */}
          <div className="flex items-center gap-1 bg-navy/5 rounded-lg p-1 self-start">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
                billingCycle === "monthly"
                  ? "bg-white text-navy shadow-sm"
                  : "text-mist hover:text-navy"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium flex items-center gap-1.5 ${
                billingCycle === "annual"
                  ? "bg-white text-navy shadow-sm"
                  : "text-mist hover:text-navy"
              }`}
            >
              Annual
              <span className="text-xs font-semibold text-teal bg-teal/10 px-1.5 py-0.5 rounded">
                −{annualSavingsPct}%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {(["starter", "growth", "business", "enterprise"] as PlanKey[]).map((plan) => {
            const cfg = PLAN_CONFIG[plan];
            const isCurrentPlan = currentPlan === plan;
            const price = billingCycle === "annual" ? cfg.annual : cfg.monthly;

            const planHighlights: Record<PlanKey, string[]> = {
              free: ["3 exits/year", "1 HR user", "Document upload"],
              starter: [
                `${PLAN_FEATURES[plan].offboardings} offboardings`,
                PLAN_FEATURES[plan].users,
                `Up to ${cfg.employeeLimit} employees`,
                "AI-guided knowledge capture",
                "Access revocation tracker",
                "Fixed exit interview template",
              ],
              growth: [
                `${PLAN_FEATURES[plan].offboardings} offboardings`,
                PLAN_FEATURES[plan].users,
                `Up to ${cfg.employeeLimit} employees`,
                "Full alumni portal + job board",
                "Boomerang hire pipeline",
                "Pulse surveys + re-engagement score",
                "AI sentiment analysis",
                "Analytics (all time)",
              ],
              business: [
                `${PLAN_FEATURES[plan].offboardings} offboardings`,
                PLAN_FEATURES[plan].users,
                `Up to ${cfg.employeeLimit} employees`,
                "AI knowledge gap detection",
                "Ask the Expert threads",
                "Consulting / gig pool",
                "Reference letter PDF generation",
                "Compliance audit export",
                "Scheduled analytics reports",
              ],
              enterprise: [
                "Unlimited everything",
                "White-label portal",
                "SSO / SAML login",
                "99.9% SLA guarantee",
                "Dedicated account manager",
                "SOC 2 / HIPAA documentation",
              ],
            };

            return (
              <Card
                key={plan}
                className={`relative ${cfg.popular ? "border-teal" : "border-navy/10"} rounded-xl`}
              >
                {cfg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="teal" className="bg-teal text-white rounded-full px-3 whitespace-nowrap">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <div className="space-y-5 pt-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{cfg.emoji}</span>
                      <h4 className="text-base font-semibold text-navy">{cfg.label}</h4>
                    </div>
                    <p className="text-xs text-mist mt-0.5">{cfg.tagline}</p>
                    {plan === "enterprise" ? (
                      <p className="text-2xl font-display text-navy mt-2">Custom</p>
                    ) : (
                      <div className="mt-2">
                        <span className="text-2xl font-display text-navy">${price}</span>
                        <span className="text-xs text-mist ml-1">/mo</span>
                        {billingCycle === "annual" && cfg.annualTotal && (
                          <p className="text-xs text-teal mt-0.5">
                            ${cfg.annualTotal}/yr · save ${cfg.annualSaving} ({cfg.annualSavingPct}%)
                          </p>
                        )}
                        {billingCycle === "monthly" && (
                          <p className="text-xs text-mist/70 mt-0.5">
                            or ${cfg.annual}/mo billed annually
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <ul className="space-y-2 text-sm">
                    {planHighlights[plan].map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-navy">
                        <CheckCircle size={13} className="text-teal mt-0.5 flex-shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrentPlan ? (
                    <Button fullWidth variant="outline" disabled>
                      Current Plan
                    </Button>
                  ) : plan === "enterprise" ? (
                    <a href="mailto:hello@offboardkit.com">
                      <Button fullWidth variant="outline">
                        Contact Sales
                      </Button>
                    </a>
                  ) : (
                    <Button
                      fullWidth
                      variant={cfg.popular ? "primary" : "outline"}
                      onClick={() => handleSubscribe(plan)}
                      loading={subscribingPlan === plan}
                      disabled={subscribingPlan !== null}
                    >
                      {subscribingPlan === plan ? "Redirecting..." : "Subscribe"}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Feature comparison table */}
        <Card className="overflow-x-auto">
          <h3 className="text-base font-semibold text-navy mb-5">Full Feature Comparison</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10">
                <th className="pb-3 text-left font-medium text-mist w-52">Feature</th>
                {(["free", "starter", "growth", "business", "enterprise"] as PlanKey[]).map((p) => (
                  <th
                    key={p}
                    className={`pb-3 text-center font-medium ${
                      p === currentPlan ? "text-teal" : "text-mist"
                    }`}
                  >
                    {PLAN_CONFIG[p].label}
                    {p === currentPlan && (
                      <span className="block text-xs font-normal text-teal/70">(current)</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROW_GROUPS.map((group) => (
                <>
                  <tr key={`group-${group.group}`}>
                    <td
                      colSpan={6}
                      className="pt-5 pb-1 text-xs font-semibold text-mist uppercase tracking-wider"
                    >
                      {group.group}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.key} className="border-b border-navy/5 last:border-0">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2 text-navy">
                          <span className="text-mist">{row.icon}</span>
                          {row.label}
                        </div>
                      </td>
                      {(["free", "starter", "growth", "business", "enterprise"] as PlanKey[]).map(
                        (p) => (
                          <td key={p} className="py-2.5 text-center">
                            <FeatureCell value={PLAN_FEATURES[p][row.key]} />
                          </td>
                        )
                      )}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* ── Contact CTA ── */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal/10 flex-shrink-0">
            <Mail size={18} className="text-teal" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-navy">Need Enterprise or have questions?</h3>
            <p className="text-sm text-mist mt-1">
              Annual plans save 16% (2 months free). Non-profits get 30% off. Startups under 1 year get 20% off their first year.
              Invoice-based payment available for Enterprise.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-3">
              <a href="mailto:hello@offboardkit.com" className="text-sm font-medium text-teal hover:underline">
                hello@offboardkit.com
              </a>
              <span className="text-xs text-mist">
                Built by Lumora Ventures PVT LTD · offboardkit.com
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
    </SettingsShell>
  );
}
