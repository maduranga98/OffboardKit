import { Fragment, useCallback, useEffect, useRef, useState } from "react";
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
  Download,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { httpsCallable } from "firebase/functions";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import { getTrialState } from "../../lib/trial";
import { getAccessState } from "../../lib/access";
import {
  PLAN_CONFIG,
  PLAN_ORDER,
  isTrialablePlan,
  type BillingCycle,
  type PlanKey,
} from "../../lib/plans";
import { getDocument } from "../../lib/firestore";
import { functions } from "../../lib/firebase";
import type { Company } from "../../types/company.types";
import { SettingsShell } from "./SettingsShell";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** One row of Stripe billing history, as the `listInvoices` callable returns it. */
interface InvoiceSummary {
  id: string;
  number: string | null;
  status: string | null;
  created: number;
  amountDue: number;
  amountPaid: number;
  currency: string;
  description: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  periodStart: number | null;
  periodEnd: number | null;
}

/**
 * Stripe reports amounts in the currency's smallest unit, and the divisor is
 * not always 100 — zero-decimal currencies such as JPY charge whole units.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

function formatInvoiceAmount(amount: number, currency: string): string {
  const code = (currency || "usd").toUpperCase();
  const minorUnits = ZERO_DECIMAL_CURRENCIES.has(currency?.toLowerCase()) ? 0 : 2;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: minorUnits,
    }).format(amount / 10 ** minorUnits);
  } catch {
    // An unknown currency code must not blank out the whole table.
    return `${(amount / 10 ** minorUnits).toFixed(minorUnits)} ${code}`;
  }
}

const INVOICE_STATUS: Record<string, { label: string; variant: "teal" | "amber" | "ember" | "mist" }> = {
  paid: { label: "Paid", variant: "teal" },
  open: { label: "Due", variant: "amber" },
  uncollectible: { label: "Unpaid", variant: "ember" },
  void: { label: "Void", variant: "mist" },
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
  knowledgeThreads: boolean;
  aiGapDetection: boolean;
  // Asset Management
  assetManagement: string;
  dataWiping: boolean;
  // Access Revocation
  accessRevocation: string;
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
  auditExport: boolean;
  scheduledReports: boolean;
  // Admin
  sso: boolean;
  sla: boolean;
  dedicatedManager: boolean;
  // Support
  support: string;
}

const PLAN_FEATURES: Record<PlanKey, PlanFeatures> = {
  basic: {
    offboardings: "3 / year",
    templates: "1",
    users: "1 HR user",
    employees: "Up to 10",
    taskRouting: false,
    removeBranding: false,
    documentUpload: true,
    aiQACapture: false,
    videoUpload: false,
    fullTextSearch: false,
    knowledgeThreads: false,
    aiGapDetection: false,
    assetManagement: "—",
    dataWiping: false,
    accessRevocation: "—",
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
    auditExport: false,
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
    knowledgeThreads: false,
    aiGapDetection: false,
    assetManagement: "Assigned → Returned",
    dataWiping: false,
    accessRevocation: "10 systems",
    complianceExport: false,
    exitInterviews: "Fixed template",
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
    analyticsDashboard: "90 days",
    csvExport: false,
    auditExport: false,
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
    knowledgeThreads: true,
    aiGapDetection: true,
    assetManagement: "Full lifecycle",
    dataWiping: true,
    accessRevocation: "Unlimited systems",
    complianceExport: false,
    exitInterviews: "Custom builder",
    aiSentiment: true,
    advancedExitAnalytics: false,
    alumniDirectory: "Full + profiles",
    boomerangPipeline: "2 stages",
    jobBoard: true,
    pulseSurveys: "—",
    reEngagementScore: true,
    askTheExpert: false,
    consultingPool: false,
    referenceLetters: true,
    analyticsDashboard: "All time",
    csvExport: true,
    auditExport: false,
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
    knowledgeThreads: true,
    aiGapDetection: true,
    assetManagement: "Full lifecycle",
    dataWiping: true,
    accessRevocation: "Unlimited systems",
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
    auditExport: true,
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
    knowledgeThreads: true,
    aiGapDetection: true,
    assetManagement: "Full lifecycle",
    dataWiping: true,
    accessRevocation: "Unlimited systems",
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
    auditExport: true,
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
      { key: "knowledgeThreads", label: "Expert Q&A threads", icon: <MessageCircle size={14} /> },
      { key: "aiGapDetection", label: "AI knowledge gap detection", icon: <Brain size={14} /> },
    ],
  },
  {
    group: "Asset Management",
    rows: [
      { key: "assetManagement", label: "Asset lifecycle tracking", icon: <Briefcase size={14} /> },
      { key: "dataWiping", label: "Data wiping workflow", icon: <Shield size={14} /> },
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
      { key: "auditExport", label: "Audit trail export (PDF/CSV)", icon: <FileText size={14} /> },
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
  const [switchingPlan, setSwitchingPlan] = useState<PlanKey | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [invoicesHasMore, setInvoicesHasMore] = useState(false);
  // Read by the post-checkout poller without becoming a dependency of it —
  // the poller calls setCompany, so depending on `company` would tear the
  // interval down and restart it on its own first result.
  const latestCompany = useRef<Company | null>(null);
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
    latestCompany.current = company;
  }, [company]);

  /**
   * Pulls billing history straight from Stripe.
   *
   * Keyed on the subscription so that finishing checkout — which the poller
   * above detects — refetches and shows the first invoice without a reload.
   */
  const subscriptionKey = company?.stripeSubscriptionId ?? null;
  const hasBillingAccount = Boolean(company?.stripeCustomerId);

  const loadInvoices = useCallback(async () => {
    if (!hasBillingAccount) {
      setInvoices([]);
      setInvoicesHasMore(false);
      setInvoicesError(null);
      setInvoicesLoading(false);
      return;
    }
    setInvoicesLoading(true);
    setInvoicesError(null);
    try {
      const list = httpsCallable<
        { limit?: number },
        { invoices: InvoiceSummary[]; hasMore: boolean }
      >(functions, "listInvoices");
      const result = await list({ limit: 12 });
      setInvoices(result.data.invoices ?? []);
      setInvoicesHasMore(Boolean(result.data.hasMore));
    } catch (err) {
      setInvoices([]);
      setInvoicesHasMore(false);
      setInvoicesError(errorMessage(err, "Could not load your invoice history"));
    } finally {
      setInvoicesLoading(false);
    }
  }, [hasBillingAccount]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    void loadInvoices();
    // subscriptionKey is intentionally a dependency: a new subscription means
    // a new invoice exists.
  }, [isSuperAdmin, loadInvoices, subscriptionKey]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      showToast("success", "Payment successful! Refreshing your plan…");
      setSearchParams({}, { replace: true });
      // The Stripe webhook fires asynchronously — poll the company doc
      // every 2s for up to 30s so the UI reflects the new plan without
      // a manual refresh. Stop as soon as the plan changes.
      if (companyId) {
        // Keyed on the subscription, not the plan: a trial company already
        // reads "starter", so buying Starter would never flip a plan check.
        const startedSubscription =
          latestCompany.current?.stripeSubscriptionId ?? null;
        let attempts = 0;
        const interval = window.setInterval(async () => {
          attempts++;
          try {
            const data = await getDocument<Company>("companies", companyId);
            if (data) {
              setCompany(data);
              if ((data.stripeSubscriptionId ?? null) !== startedSubscription) {
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
  }, [searchParams, setSearchParams, companyId]);

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

  const trial = getTrialState(company);
  // While the trial runs the company sits on Starter without having paid, and
  // an expired one still reads "starter" until the hourly sweep lands — so
  // the page shows Basic rather than a plan they no longer have.
  const currentPlan = (
    trial.hasExpired && company.trialStatus === "active"
      ? "basic"
      : company.plan || "basic"
  ) as PlanKey;
  const onTrial = trial.isActive;
  const access = getAccessState(company);
  const planConfig = PLAN_CONFIG[currentPlan] || PLAN_CONFIG.basic;
  const usageCount = company.usageCount || { offboardingsThisYear: 0, activeOffboardings: 0 };
  const memberSince = company.createdAt?.toDate?.()
    ? format(company.createdAt.toDate(), "MMMM yyyy")
    : "Unknown";

  const annualSavingsPct = 16;

  /**
   * Moves the running trial onto a different package.
   *
   * Trying one plan should not force a purchase to see another. The server
   * leaves `trialEndsAt` alone, so this changes what is unlocked for the rest
   * of the week and nothing else — no card, no charge.
   */
  const handleSwitchTrialPlan = async (plan: PlanKey) => {
    if (!company) return;
    setSwitchingPlan(plan);
    try {
      const selectTrialPlan = httpsCallable<{ plan: PlanKey }, { plan: PlanKey }>(
        functions,
        "selectTrialPlan"
      );
      await selectTrialPlan({ plan });
      const fresh = await getDocument<Company>("companies", company.id);
      if (fresh) setCompany(fresh);
      showToast("success", `Your trial is now on ${PLAN_CONFIG[plan].label}.`);
    } catch (err) {
      showToast("error", errorMessage(err, "Could not change your trial plan"));
    } finally {
      setSwitchingPlan(null);
    }
  };

  const handleSubscribe = async (plan: PlanKey) => {
    if (!companyId) return;
    setSubscribingPlan(plan);
    try {
      const createSession = httpsCallable(functions, "createCheckoutSession");
      // Tell the server where this app is actually running, so Stripe returns
      // the customer here rather than to the single address APP_URL names
      // (which is the marketing site). The server allowlists it.
      const result = await createSession({
        plan,
        billingCycle,
        returnOrigin: window.location.origin,
      });
      const { url } = result.data as { url: string | null };
      if (url) {
        window.location.href = url;
      } else {
        showToast("error", "Failed to start checkout");
      }
    } catch (err) {
      showToast("error", errorMessage(err, "Failed to start checkout"));
    } finally {
      setSubscribingPlan(null);
    }
  };

  // Plan changes, card updates, invoices, and cancellation all live in the
  // Stripe customer portal rather than being rebuilt here.
  const handleManageBilling = async () => {
    if (!company.stripeCustomerId) return;
    setOpeningPortal(true);
    try {
      const createPortal = httpsCallable(functions, "createBillingPortalSession");
      const result = await createPortal({ returnOrigin: window.location.origin });
      const { url } = result.data as { url: string | null };
      if (url) {
        window.location.href = url;
      } else {
        showToast("error", "Could not open the billing portal");
      }
    } catch (err) {
      showToast("error", errorMessage(err, "Could not open the billing portal"));
    } finally {
      setOpeningPortal(false);
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
                <Badge variant={access.isLocked ? "mist" : planConfig.color}>
                  {access.isLocked ? "No active plan" : planConfig.label}
                </Badge>
                {onTrial && <Badge variant="amber">Free trial</Badge>}
              </div>
              <div>
                <h2 className="text-3xl font-display text-navy">
                  {planConfig.monthly === null
                    ? "Custom"
                    : `$${billingCycle === "annual" ? planConfig.annual : planConfig.monthly}`}
                  {planConfig.monthly !== null && (
                    <span className="text-base font-normal text-mist ml-1">/mo</span>
                  )}
                </h2>
                {planConfig.monthly !== null && billingCycle === "annual" && (
                  <p className="text-xs text-teal mt-0.5">
                    Billed annually — save {planConfig.annualSavingPct ?? annualSavingsPct}%
                  </p>
                )}
              </div>
              {onTrial ? (
                <p className="text-sm text-navy">
                  <strong className="font-semibold">
                    {trial.daysRemaining}{" "}
                    {trial.daysRemaining === 1 ? "day" : "days"} left
                  </strong>{" "}
                  &middot; no card on file. Choose a plan to keep these
                  features{trial.endsAt ? ` after ${format(trial.endsAt, "d MMM")}` : ""}.
                </p>
              ) : (
                access.isLocked && (
                  <p className="text-sm text-ember">
                    {access.lockedAfterTrial
                      ? "Your free trial has ended. OffboardKit is locked until you choose a plan."
                      : "Your subscription is no longer active. OffboardKit is locked until you renew."}
                  </p>
                )
              )}
              <p className="text-sm text-mist">Member since {memberSince}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal/10">
              <CreditCard size={22} className="text-teal" />
            </div>
          </div>

          {currentPlan === "basic" && !access.isLocked && (
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
                    Basic plan limit reached. Upgrade to continue running offboardings.
                  </p>
                </div>
              )}
            </div>
          )}

          {currentPlan !== "basic" && (
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
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={!company.stripeCustomerId || openingPortal}
                onClick={handleManageBilling}
              >
                {openingPortal ? "Opening…" : "Manage billing"}
              </Button>
              <p className="text-xs text-mist mt-2">
                {company.stripeCustomerId
                  ? "Change plan, update your card, download invoices, or cancel."
                  : "Available once you subscribe to a paid plan."}
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
          <Button
            variant="outline"
            size="sm"
            disabled={!company.stripeCustomerId || openingPortal}
            onClick={handleManageBilling}
          >
            {company.stripeCustomerId ? "Manage in Stripe" : "Add Card"}
          </Button>
        </div>
      </Card>

      {/* ── Invoice History ── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-navy">Invoice History</h3>
          <div className="flex items-center gap-1">
            {company.stripeCustomerId && (
              <Button
                variant="ghost"
                size="sm"
                disabled={invoicesLoading}
                onClick={() => void loadInvoices()}
              >
                <RefreshCw
                  size={14}
                  className={`mr-1.5 ${invoicesLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={!company.stripeCustomerId || openingPortal}
              onClick={handleManageBilling}
            >
              <FileText size={14} className="mr-1.5" />
              View in Stripe
            </Button>
          </div>
        </div>

        {invoicesLoading ? (
          <div className="flex justify-center py-8 border-t border-navy/5">
            <LoadingSpinner />
          </div>
        ) : invoicesError ? (
          <div className="py-8 text-center border-t border-navy/5">
            <p className="text-sm text-ember">{invoicesError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void loadInvoices()}
            >
              Try again
            </Button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-8 text-center text-sm text-mist border-t border-navy/5">
            {company.stripeCustomerId
              ? "No invoices yet. Your first one arrives at the end of this billing period."
              : "No invoices yet. Billing starts when you upgrade to a paid plan."}
          </div>
        ) : (
          <div className="border-t border-navy/5 -mx-6 -mb-6 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-mist">
                  <th className="text-left font-medium px-6 py-3">Invoice</th>
                  <th className="text-left font-medium px-3 py-3">Date</th>
                  <th className="text-left font-medium px-3 py-3">Status</th>
                  <th className="text-right font-medium px-3 py-3">Amount</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const status =
                    INVOICE_STATUS[invoice.status ?? ""] ??
                    { label: invoice.status ?? "Unknown", variant: "mist" as const };
                  return (
                    <tr
                      key={invoice.id}
                      className="border-t border-navy/5 hover:bg-navy/[0.02] transition-colors"
                    >
                      <td className="px-6 py-3">
                        <p className="font-medium text-navy">
                          {invoice.number || "Invoice"}
                        </p>
                        {invoice.description && (
                          <p className="text-xs text-mist mt-0.5 line-clamp-1">
                            {invoice.description}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-mist whitespace-nowrap">
                        {format(new Date(invoice.created * 1000), "d MMM yyyy")}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-navy whitespace-nowrap">
                        {formatInvoiceAmount(
                          invoice.status === "paid" ? invoice.amountPaid : invoice.amountDue,
                          invoice.currency
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-3">
                          {invoice.invoicePdf && (
                            <a
                              href={invoice.invoicePdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-mist hover:text-navy transition-colors"
                              title="Download PDF"
                              aria-label={`Download PDF for invoice ${invoice.number || invoice.id}`}
                            >
                              <Download size={15} />
                            </a>
                          )}
                          {invoice.hostedInvoiceUrl && (
                            <a
                              href={invoice.hostedInvoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-mist hover:text-navy transition-colors"
                              title="View invoice"
                              aria-label={`View invoice ${invoice.number || invoice.id}`}
                            >
                              <ExternalLink size={15} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {invoicesHasMore && (
              <p className="px-6 py-3 text-xs text-mist border-t border-navy/5">
                Showing your {invoices.length} most recent invoices —{" "}
                <button
                  type="button"
                  onClick={handleManageBilling}
                  disabled={openingPortal}
                  className="text-teal hover:underline disabled:opacity-60"
                >
                  see all in Stripe
                </button>
                .
              </p>
            )}
          </div>
        )}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4 items-stretch">
          {PLAN_ORDER.map((plan) => {
            const cfg = PLAN_CONFIG[plan];
            const isCurrentPlan = currentPlan === plan;
            const price = billingCycle === "annual" ? cfg.annual : cfg.monthly;

            const planHighlights: Record<PlanKey, string[]> = {
              basic: [
                "3 exits/year",
                "1 HR user",
                "Up to 10 employees",
                "Document upload",
                "Secure employee exit portal",
                "Basic email notifications",
              ],
              starter: [
                `${PLAN_FEATURES[plan].offboardings} offboardings`,
                PLAN_FEATURES[plan].users,
                `Up to ${cfg.employeeLimit} employees`,
                "All 6 task types + e-signature",
                "AI-guided knowledge capture",
                "Basic asset tracking",
                "Access revocation (10 systems)",
                "Fixed exit interview template",
              ],
              growth: [
                `${PLAN_FEATURES[plan].offboardings} offboardings`,
                PLAN_FEATURES[plan].users,
                `Up to ${cfg.employeeLimit} employees`,
                "Unlimited templates + approval flow",
                "AI gap detection + knowledge threads",
                "Full asset lifecycle + data wiping",
                "Alumni portal + job board",
                "AI sentiment + custom exit interviews",
                "Analytics (all time) + CSV export",
              ],
              business: [
                `${PLAN_FEATURES[plan].offboardings} offboardings`,
                PLAN_FEATURES[plan].users,
                `Up to ${cfg.employeeLimit} employees`,
                "Pulse surveys + consulting pool",
                "Ask the Expert threads",
                "Full alumni portal + gig requests",
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
                className={`relative flex h-full flex-col ${
                  cfg.popular ? "border-teal ring-1 ring-teal/20" : "border-navy/10"
                } rounded-xl`}
              >
                {cfg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="teal" className="bg-teal text-white rounded-full px-3 whitespace-nowrap">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-5 pt-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <cfg.icon className="w-4 h-4 text-navy" aria-hidden="true" />
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

                  {/* mt-auto keeps every CTA on the same baseline regardless of
                      how many highlights a plan lists */}
                  <div className="mt-auto pt-1 space-y-2">
                    {isCurrentPlan ? (
                      <Button fullWidth variant="outline" disabled>
                        {onTrial ? "Trialing this plan" : "Current Plan"}
                      </Button>
                    ) : plan === "enterprise" ? (
                      <a href="mailto:hello@offboardkit.com" className="block">
                        <Button fullWidth variant="outline">
                          Contact Sales
                        </Button>
                      </a>
                    ) : (
                      <>
                        <Button
                          fullWidth
                          variant={cfg.popular ? "primary" : "outline"}
                          onClick={() => handleSubscribe(plan)}
                          loading={subscribingPlan === plan}
                          disabled={subscribingPlan !== null || switchingPlan !== null}
                        >
                          {subscribingPlan === plan ? "Redirecting..." : "Subscribe"}
                        </Button>
                        {/* Mid-trial, a company can move its remaining days to
                            another package instead of paying to evaluate it. */}
                        {onTrial && isTrialablePlan(plan) && (
                          <Button
                            fullWidth
                            variant="ghost"
                            onClick={() => handleSwitchTrialPlan(plan)}
                            loading={switchingPlan === plan}
                            disabled={subscribingPlan !== null || switchingPlan !== null}
                          >
                            Try it instead
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Feature comparison table */}
        <Card>
          <h3 className="text-base font-semibold text-navy mb-5">Full Feature Comparison</h3>
          {/* Table scrolls inside its own container so the page body never
              scrolls horizontally on small screens */}
          <div className="-mx-6 overflow-x-auto px-6">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-navy/10">
                <th className="pb-3 text-left font-medium text-mist w-52">Feature</th>
                {PLAN_ORDER.map((p) => (
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
                <Fragment key={group.group}>
                  <tr>
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
                      {PLAN_ORDER.map(
                        (p) => (
                          <td key={p} className="py-2.5 text-center">
                            <FeatureCell value={PLAN_FEATURES[p][row.key]} />
                          </td>
                        )
                      )}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
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
