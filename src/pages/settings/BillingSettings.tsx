import { useEffect, useState } from "react";
import { CheckCircle, Zap, Mail } from "lucide-react";
import { format } from "date-fns";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import { getDocument } from "../../lib/firestore";
import type { Company } from "../../types/company.types";

const PLAN_CONFIG = {
  free: {
    label: "Free",
    color: "mist" as const,
    limit: 3,
    price: "$0",
  },
  starter: {
    label: "Starter",
    color: "teal" as const,
    limit: null,
    price: "$29/mo",
  },
  growth: {
    label: "Growth",
    color: "navy" as const,
    limit: null,
    price: "$79/mo",
  },
  business: {
    label: "Business",
    color: "amber" as const,
    limit: null,
    price: "$199/mo",
  },
  enterprise: {
    label: "Enterprise",
    color: "amber" as const,
    limit: null,
    price: "Custom",
  },
};

export default function BillingSettings() {
  const { companyId } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getDocument<Company>("companies", companyId);
        if (data) {
          setCompany(data);
        }
      } catch {
        showToast("error", "Failed to load billing information");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

  if (loading) {
    return (
      <Card>
        <LoadingSpinner />
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

  const currentPlan = company.plan || "free";
  const planConfig = PLAN_CONFIG[currentPlan as keyof typeof PLAN_CONFIG] || PLAN_CONFIG.free;
  const usageCount = company.usageCount || { offboardingsThisYear: 0, activeOffboardings: 0 };
  const memberSince = company.createdAt?.toDate?.()
    ? format(company.createdAt.toDate(), "MMMM yyyy")
    : "Unknown";

  const scrollToUpgrade = () => {
    document.querySelector("#available-plans")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-mist">Current Plan</span>
            <Badge variant={planConfig.color}>{planConfig.label}</Badge>
          </div>

          <div>
            <h2 className="text-2xl font-display text-navy">{planConfig.label}</h2>
            <p className="text-sm text-mist mt-1">{planConfig.price}</p>
          </div>

          <p className="text-sm text-mist">
            Member since {memberSince}
          </p>

          {currentPlan === "free" ? (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-navy">
                    Offboardings used this year
                  </span>
                  <span className="text-sm text-mist">
                    {usageCount.offboardingsThisYear} of 3
                  </span>
                </div>
                <div className="w-full h-2 bg-navy/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      usageCount.offboardingsThisYear >= 3
                        ? "bg-ember"
                        : "bg-teal"
                    }`}
                    style={{
                      width: `${Math.min((usageCount.offboardingsThisYear / 3) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-4">
                <Zap size={16} className="text-amber-700 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-amber-900">
                    You are on the Free plan. Upgrade to run unlimited offboardings.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={scrollToUpgrade}
                  >
                    Upgrade Now
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-teal text-sm">
              <CheckCircle size={16} />
              <span>Unlimited offboardings</span>
            </div>
          )}
        </div>
      </Card>

      {/* Available Plans */}
      <div id="available-plans" className="space-y-4">
        <div>
          <h3 className="text-lg font-display text-navy">Available Plans</h3>
          <p className="text-sm text-mist mt-1">
            Stripe billing coming soon — contact us to upgrade early.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Starter Plan */}
          <Card className="border-navy/10 rounded-xl relative">
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-semibold text-navy">Starter</h4>
                <p className="text-2xl font-display text-navy mt-1">$29</p>
                <p className="text-xs text-mist">/month</p>
              </div>

              <ul className="space-y-2 text-sm text-navy">
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>Up to 50 employees</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>Unlimited offboardings</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>Knowledge transfer Q&A</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>Access revocation tracker</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>Basic exit interviews</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>3 HR users</span>
                </li>
              </ul>

              <Button variant="outline" disabled>
                Coming Soon
              </Button>
            </div>
          </Card>

          {/* Growth Plan - Most Popular */}
          <Card className="border-[#0D9E8A] rounded-xl relative">
            <div className="absolute -top-3 right-4">
              <Badge variant="teal" className="bg-[#0D9E8A] text-white rounded-full">
                Most Popular
              </Badge>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-semibold text-navy">Growth</h4>
                <p className="text-2xl font-display text-navy mt-1">$79</p>
                <p className="text-xs text-mist">/month</p>
              </div>

              <ul className="space-y-2 text-sm text-navy">
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>Up to 200 employees</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>Everything in Starter</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>AI sentiment analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>Video walkthroughs</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>Alumni portal (basic)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>Slack integration</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>10 HR users</span>
                </li>
              </ul>

              <Button disabled>
                Coming Soon
              </Button>
            </div>
          </Card>

          {/* Business Plan */}
          <Card className="border-navy/10 rounded-xl">
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-semibold text-navy">Business</h4>
                <p className="text-2xl font-display text-navy mt-1">$199</p>
                <p className="text-xs text-mist">/month</p>
              </div>

              <ul className="space-y-2 text-sm text-navy">
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>Up to 500 employees</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>Everything in Growth</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>AI knowledge gap detection</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>Full alumni portal + job board</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>Advanced analytics</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>API access (read-only)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-teal mt-0.5 flex-shrink-0" />
                  <span>25 HR users</span>
                </li>
              </ul>

              <Button variant="outline" disabled>
                Coming Soon
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Contact Card */}
      <Card>
        <div className="flex items-start gap-4">
          <Mail size={20} className="text-teal mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-navy">Want to upgrade early?</h3>
            <p className="text-sm text-mist mt-1 mb-3">
              We'll set it up manually.
            </p>
            <a
              href="mailto:hello@offboardkit.com"
              className="text-sm text-teal hover:underline font-medium"
            >
              hello@offboardkit.com
            </a>
            <p className="text-xs text-mist mt-2">
              Annual plans available — save 2 months.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
