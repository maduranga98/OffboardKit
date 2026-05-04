import { useEffect, useState } from "react";
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
} from "lucide-react";
import { format } from "date-fns";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import { getDocument } from "../../lib/firestore";
import type { Company } from "../../types/company.types";

type PlanKey = "free" | "starter" | "growth" | "business" | "enterprise";
type BillingCycle = "monthly" | "annual";

const PLAN_CONFIG: Record<
  PlanKey,
  {
    label: string;
    monthly: number | null;
    annual: number | null;
    color: "mist" | "teal" | "navy" | "amber";
    userLimit: number | null;
    employeeLimit: number | null;
    popular?: boolean;
  }
> = {
  free: { label: "Free", monthly: 0, annual: 0, color: "mist", userLimit: 2, employeeLimit: null },
  starter: { label: "Starter", monthly: 29, annual: 24, color: "teal", userLimit: 3, employeeLimit: 50 },
  growth: { label: "Growth", monthly: 79, annual: 66, color: "teal", userLimit: 10, employeeLimit: 200, popular: true },
  business: { label: "Business", monthly: 199, annual: 166, color: "navy", userLimit: 25, employeeLimit: 500 },
  enterprise: { label: "Enterprise", monthly: null, annual: null, color: "amber", userLimit: null, employeeLimit: null },
};

interface PlanFeatures {
  offboardings: string;
  users: string;
  knowledgeTransfer: boolean;
  aiGapDetection: boolean;
  aiSentiment: boolean;
  exitInterviews: boolean;
  accessRevocation: boolean;
  advancedAnalytics: boolean;
  alumniPortal: boolean;
  apiAccess: boolean;
  sla: boolean;
  slack: boolean;
}

const PLAN_FEATURES: Record<PlanKey, PlanFeatures> = {
  free: {
    offboardings: "3/year",
    users: "2 HR users",
    knowledgeTransfer: true,
    aiGapDetection: false,
    aiSentiment: false,
    exitInterviews: true,
    accessRevocation: true,
    advancedAnalytics: false,
    alumniPortal: false,
    apiAccess: false,
    sla: false,
    slack: false,
  },
  starter: {
    offboardings: "Unlimited",
    users: "3 HR users",
    knowledgeTransfer: true,
    aiGapDetection: false,
    aiSentiment: false,
    exitInterviews: true,
    accessRevocation: true,
    advancedAnalytics: false,
    alumniPortal: false,
    apiAccess: false,
    sla: false,
    slack: false,
  },
  growth: {
    offboardings: "Unlimited",
    users: "10 HR users",
    knowledgeTransfer: true,
    aiGapDetection: true,
    aiSentiment: true,
    exitInterviews: true,
    accessRevocation: true,
    advancedAnalytics: true,
    alumniPortal: true,
    apiAccess: false,
    sla: false,
    slack: true,
  },
  business: {
    offboardings: "Unlimited",
    users: "25 HR users",
    knowledgeTransfer: true,
    aiGapDetection: true,
    aiSentiment: true,
    exitInterviews: true,
    accessRevocation: true,
    advancedAnalytics: true,
    alumniPortal: true,
    apiAccess: true,
    sla: true,
    slack: true,
  },
  enterprise: {
    offboardings: "Unlimited",
    users: "Unlimited",
    knowledgeTransfer: true,
    aiGapDetection: true,
    aiSentiment: true,
    exitInterviews: true,
    accessRevocation: true,
    advancedAnalytics: true,
    alumniPortal: true,
    apiAccess: true,
    sla: true,
    slack: true,
  },
};

const FEATURE_ROWS: { key: keyof PlanFeatures; label: string; icon: React.ReactNode }[] = [
  { key: "offboardings", label: "Offboardings", icon: <FileText size={14} /> },
  { key: "users", label: "HR Users", icon: <Users size={14} /> },
  { key: "knowledgeTransfer", label: "Knowledge transfer", icon: <FileText size={14} /> },
  { key: "exitInterviews", label: "Exit interviews", icon: <FileText size={14} /> },
  { key: "accessRevocation", label: "Access revocation tracker", icon: <Lock size={14} /> },
  { key: "aiGapDetection", label: "AI gap detection", icon: <Brain size={14} /> },
  { key: "aiSentiment", label: "AI sentiment analysis", icon: <Brain size={14} /> },
  { key: "advancedAnalytics", label: "Advanced analytics", icon: <BarChart2 size={14} /> },
  { key: "alumniPortal", label: "Alumni portal", icon: <Globe size={14} /> },
  { key: "slack", label: "Slack integration", icon: <Zap size={14} /> },
  { key: "apiAccess", label: "API access", icon: <Lock size={14} /> },
  { key: "sla", label: "SLA + priority support", icon: <CheckCircle size={14} /> },
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
  const { companyId } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

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

  if (loading) {
    return (
      <Card>
        <div className="flex justify-center py-12">
          <LoadingSpinner />
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

  const annualSavingsPct = 17; // 2 months free

  return (
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
                    {usageCount.offboardingsThisYear} / 3
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-navy/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usageCount.offboardingsThisYear >= 3 ? "bg-ember" : "bg-teal"
                    }`}
                    style={{ width: `${Math.min((usageCount.offboardingsThisYear / 3) * 100, 100)}%` }}
                  />
                </div>
              </div>
              {usageCount.offboardingsThisYear >= 3 && (
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
              <p className="text-xs text-mist mt-0.5">Stripe integration coming soon</p>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled>
            Add Card
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
              Stripe billing coming soon — contact us to upgrade early.
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
                    <h4 className="text-base font-semibold text-navy">{cfg.label}</h4>
                    {plan === "enterprise" ? (
                      <p className="text-2xl font-display text-navy mt-1">Custom</p>
                    ) : (
                      <div className="mt-1">
                        <span className="text-2xl font-display text-navy">${price}</span>
                        <span className="text-xs text-mist ml-1">/mo</span>
                        {billingCycle === "annual" && (
                          <p className="text-xs text-teal mt-0.5">
                            ${price! * 12}/yr · saves ${(cfg.monthly! - price!) * 12}/yr
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <ul className="space-y-2 text-sm">
                    {[
                      PLAN_FEATURES[plan].offboardings,
                      `${PLAN_FEATURES[plan].users}`,
                      PLAN_FEATURES[plan].aiGapDetection ? "AI gap detection" : null,
                      PLAN_FEATURES[plan].aiSentiment ? "AI sentiment analysis" : null,
                      PLAN_FEATURES[plan].advancedAnalytics ? "Advanced analytics" : null,
                      PLAN_FEATURES[plan].alumniPortal ? "Alumni portal" : null,
                      PLAN_FEATURES[plan].slack ? "Slack integration" : null,
                      PLAN_FEATURES[plan].apiAccess ? "API access" : null,
                      PLAN_FEATURES[plan].sla ? "SLA + priority support" : null,
                    ]
                      .filter(Boolean)
                      .map((feat) => (
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
                      disabled
                    >
                      Coming Soon
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
                <th className="pb-3 text-left font-medium text-mist w-48">Feature</th>
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
              {FEATURE_ROWS.map((row) => (
                <tr key={row.key} className="border-b border-navy/5 last:border-0">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2 text-navy">
                      <span className="text-mist">{row.icon}</span>
                      {row.label}
                    </div>
                  </td>
                  {(["free", "starter", "growth", "business", "enterprise"] as PlanKey[]).map(
                    (p) => (
                      <td key={p} className="py-3 text-center">
                        <FeatureCell value={PLAN_FEATURES[p][row.key]} />
                      </td>
                    )
                  )}
                </tr>
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
            <h3 className="font-semibold text-navy">Upgrade early or need Enterprise?</h3>
            <p className="text-sm text-mist mt-1">
              We can set up your plan manually while Stripe billing is being rolled out.
              Annual plans available — save 2 months.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-3">
              <a href="mailto:hello@offboardkit.com" className="text-sm font-medium text-teal hover:underline">
                hello@offboardkit.com
              </a>
              <span className="text-xs text-mist">
                Usually responds within 1 business day
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
