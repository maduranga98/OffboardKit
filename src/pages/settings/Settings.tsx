import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Building, Users, CreditCard, Plug, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import {
  getDocument,
  updateDocument,
  serverTimestamp,
} from "../../lib/firestore";
import type { Company } from "../../types/company.types";

const INDUSTRIES = [
  "Technology",
  "Finance",
  "Healthcare",
  "Education",
  "Retail",
  "Manufacturing",
  "Consulting",
  "Media",
  "Non-profit",
  "Other",
];

const SIZES = ["10-50", "50-200", "200-500", "500+"];

const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "India",
  "Singapore",
  "Other",
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

const PLAN_BADGE_VARIANTS: Record<
  string,
  "teal" | "navy" | "amber" | "mist"
> = {
  free: "mist",
  starter: "teal",
  pro: "navy",
  enterprise: "amber",
};

const navItems = [
  { label: "Company Profile", href: "/settings", icon: Building },
  { label: "Team & Roles", href: "/settings/team", icon: Users },
  { label: "Billing", href: "/settings/billing", icon: CreditCard },
  { label: "Integrations", href: "/settings/integrations", icon: Plug },
];

function SettingsSidebar() {
  return (
    <nav className="space-y-1">
      {navItems.map(({ label, href, icon: Icon }) => (
        <NavLink
          key={href}
          to={href}
          end={href === "/settings"}
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-teal/10 text-teal"
                : "text-mist hover:text-navy hover:bg-navy/5"
            )
          }
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Settings() {
  const { companyId } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [country, setCountry] = useState("");
  const [timezone, setTimezone] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [brandColor, setBrandColor] = useState("#0D9E8A");
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getDocument<Company>("companies", companyId);
        if (data) {
          setCompany(data);
          setName(data.name || "");
          setIndustry(data.industry || "");
          setSize(data.size || "");
          setCountry(data.country || "");
          setTimezone(data.timezone || "");
          setNotificationEmail(data.settings?.notificationEmail || "");
          setBrandColor(data.settings?.brandColor || "#0D9E8A");
          setSlackWebhookUrl(data.settings?.slackWebhookUrl || "");
        }
      } catch {
        showToast("error", "Failed to load company settings");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      await updateDocument("companies", companyId, {
        name,
        industry,
        size,
        country,
        timezone,
        updatedAt: serverTimestamp(),
        "settings.notificationEmail": notificationEmail,
        "settings.brandColor": brandColor,
        "settings.slackWebhookUrl": slackWebhookUrl,
      });
      showToast("success", "Settings saved");
    } catch {
      showToast("error", "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const selectClass =
    "block w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-navy">Settings</h1>
        <p className="text-sm text-mist mt-1">
          Manage your company settings and preferences
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-52 flex-shrink-0">
          <Card padding="sm">
            <SettingsSidebar />
          </Card>
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-6 min-w-0">
          {loading ? (
            <Card>
              <LoadingSpinner />
            </Card>
          ) : (
            <>
              {/* Company Profile */}
              <Card>
                <div className="space-y-4">
                  <h2 className="text-base font-semibold text-navy">
                    Company Profile
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Input
                        label="Company Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-navy">
                        Industry
                      </label>
                      <select
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Select industry...</option>
                        {INDUSTRIES.map((i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-navy">
                        Company Size
                      </label>
                      <select
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Select size...</option>
                        {SIZES.map((s) => (
                          <option key={s} value={s}>
                            {s} employees
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-navy">
                        Country
                      </label>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Select country...</option>
                        {COUNTRIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-navy">
                        Timezone
                      </label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Select timezone...</option>
                        {TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Notifications & Integrations */}
              <Card>
                <div className="space-y-4">
                  <h2 className="text-base font-semibold text-navy">
                    Notifications & Integrations
                  </h2>
                  <Input
                    label="Notification Email"
                    type="email"
                    placeholder="notifications@yourcompany.com"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                  />
                  <Input
                    label="Slack Webhook URL"
                    placeholder="https://hooks.slack.com/... (optional)"
                    value={slackWebhookUrl}
                    onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  />
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-navy">
                      Brand Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        className="h-9 w-16 rounded-md border border-navy/20 cursor-pointer p-0.5"
                      />
                      <span className="text-sm text-mist font-mono">
                        {brandColor}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Account Info (read-only) */}
              {company && (
                <Card>
                  <div className="space-y-4">
                    <h2 className="text-base font-semibold text-navy">
                      Account Info
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-mist text-xs mb-1.5">Plan</p>
                        <Badge
                          variant={
                            PLAN_BADGE_VARIANTS[company.plan] ?? "mist"
                          }
                        >
                          {PLAN_LABELS[company.plan] ?? company.plan}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-mist text-xs mb-1.5">Domain</p>
                        <p className="text-navy font-medium">
                          {company.domain || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-mist text-xs mb-1.5">Member Since</p>
                        <p className="text-navy font-medium">
                          {company.createdAt?.toDate
                            ? format(company.createdAt.toDate(), "MMMM yyyy")
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/settings/billing")}
                    >
                      <ExternalLink size={14} className="mr-1.5" />
                      Upgrade Plan
                    </Button>
                  </div>
                </Card>
              )}

              <div className="flex justify-end pb-6">
                <Button onClick={handleSave} loading={saving}>
                  Save Changes
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
