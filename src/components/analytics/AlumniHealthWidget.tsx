import { useState, useEffect, useCallback } from "react";
import { Network, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import clsx from "clsx";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Timestamp } from "firebase/firestore";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { queryDocuments } from "../../lib/firestore";
import { Card } from "../ui/Card";
import { EmptyState } from "../shared/EmptyState";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlumniProfile {
  id: string;
  companyId: string;
  optedIn?: boolean;
  openToReturn?: boolean;
  rehirePriority?: "high" | "medium" | "low" | null;
  engagementLevel?: "high" | "medium" | "low" | null;
  engagementScore?: number | null;
  boomerangStage?: "potential" | "contacted" | "interviewing" | "rehired" | null;
  name?: string;
  fullName?: string;
}

interface AlumniApplication {
  id: string;
  companyId: string;
  type: "self" | "referral";
  status: "new" | "reviewed" | "shortlisted" | "rejected" | "hired";
}

interface PulseResponse {
  id: string;
  companyId: string;
  status?: string;
}

interface EngagementLogEntry {
  id: string;
  companyId: string;
  alumniId?: string;
  eventType: string;
  createdAt: Timestamp;
}

interface AlumniJob {
  id: string;
  companyId: string;
  status: string;
}

interface KnowledgeThread {
  id: string;
  companyId: string;
  status: string;
}

interface AlumniHealthData {
  totalAlumni: number;
  optedIn: number;
  openToRehire: number;
  engagementBreakdown: { high: number; medium: number; low: number; null: number };
  avgEngagementLabel: "High" | "Medium" | "Low" | "N/A";
  boomerangCounts: { potential: number; contacted: number; interviewing: number; rehired: number };
  referralsSubmitted: number;
  referralsHired: number;
  referralConversionRate: number;
  selfApplications: number;
  pulseResponseRate: number | null;
  mostRecentActivity: { alumniName: string; eventType: string; createdAt: Timestamp } | null;
  openJobs: number;
  openThreads: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const firstName = (name: string) => name.split(" ")[0];

const EVENT_LABELS: Record<string, string> = {
  login: "logged in",
  job_viewed: "viewed a job",
  referral_submitted: "submitted a referral",
  survey_responded: "responded to survey",
  return_toggle: "updated return status",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlumniHealthWidget({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AlumniHealthData | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);

    try {
      const q5Promise = getDocs(
        query(
          collection(db, "alumniEngagementLog"),
          where("companyId", "==", companyId),
          orderBy("createdAt", "desc"),
          limit(1)
        )
      );

      const [
        profiles,
        referrals,
        selfApps,
        pulseResponses,
        jobs,
        threads,
        engagementSnap,
      ] = await Promise.all([
        queryDocuments<AlumniProfile>("alumniProfiles", [
          where("companyId", "==", companyId),
        ]).catch(() => [] as AlumniProfile[]),
        queryDocuments<AlumniApplication>("alumniApplications", [
          where("companyId", "==", companyId),
          where("type", "==", "referral"),
        ]).catch(() => [] as AlumniApplication[]),
        queryDocuments<AlumniApplication>("alumniApplications", [
          where("companyId", "==", companyId),
          where("type", "==", "self"),
        ]).catch(() => [] as AlumniApplication[]),
        queryDocuments<PulseResponse>("pulseResponses", [
          where("companyId", "==", companyId),
        ]).catch(() => [] as PulseResponse[]),
        queryDocuments<AlumniJob>("alumniJobs", [
          where("companyId", "==", companyId),
          where("status", "==", "open"),
        ]).catch(() => [] as AlumniJob[]),
        queryDocuments<KnowledgeThread>("knowledgeThreads", [
          where("companyId", "==", companyId),
          where("status", "==", "open"),
        ]).catch(() => [] as KnowledgeThread[]),
        q5Promise.catch(() => null),
      ]);

      // Q1 derivations
      const totalAlumni = profiles.length;
      const optedIn = profiles.filter((p) => p.optedIn).length;
      const openToRehire = profiles.filter(
        (p) => p.openToReturn === true || p.rehirePriority === "high" || p.rehirePriority === "medium"
      ).length;
      const engagementBreakdown = {
        high: profiles.filter((p) => p.engagementLevel === "high").length,
        medium: profiles.filter((p) => p.engagementLevel === "medium").length,
        low: profiles.filter((p) => p.engagementLevel === "low").length,
        null: profiles.filter((p) => !p.engagementLevel).length,
      };
      const scored = profiles.filter((p) => p.engagementScore !== null && p.engagementScore !== undefined);
      let avgEngagementLabel: "High" | "Medium" | "Low" | "N/A" = "N/A";
      if (scored.length > 0) {
        const avg = scored.reduce((s, p) => s + (p.engagementScore ?? 0), 0) / scored.length;
        avgEngagementLabel = avg >= 70 ? "High" : avg >= 40 ? "Medium" : "Low";
      }
      const boomerangCounts = {
        potential: profiles.filter((p) => p.boomerangStage === "potential").length,
        contacted: profiles.filter((p) => p.boomerangStage === "contacted").length,
        interviewing: profiles.filter((p) => p.boomerangStage === "interviewing").length,
        rehired: profiles.filter((p) => p.boomerangStage === "rehired").length,
      };

      // Q2 derivations
      const referralsSubmitted = referrals.length;
      const referralsHired = referrals.filter((r) => r.status === "hired").length;
      const referralConversionRate =
        referralsSubmitted > 0 ? Math.round((referralsHired / referralsSubmitted) * 100) : 0;

      // Q3
      const selfApplications = selfApps.length;

      // Q4
      const totalSent = pulseResponses.length;
      const totalResponded = pulseResponses.filter((r) => r.status === "completed").length;
      const pulseResponseRate = totalSent > 0 ? Math.round((totalResponded / totalSent) * 100) : null;

      // Q5
      let mostRecentActivity: AlumniHealthData["mostRecentActivity"] = null;
      if (engagementSnap && !engagementSnap.empty) {
        const doc = engagementSnap.docs[0];
        const entry = { id: doc.id, ...doc.data() } as EngagementLogEntry;
        const alumniProfile = profiles.find((p) => p.id === entry.alumniId);
        const alumniName =
          alumniProfile?.fullName ?? alumniProfile?.name ?? entry.alumniId ?? "Alumni";
        mostRecentActivity = {
          alumniName,
          eventType: entry.eventType,
          createdAt: entry.createdAt,
        };
      }

      // Q6 & Q7
      const openJobs = jobs.length;
      const openThreads = threads.length;

      setData({
        totalAlumni,
        optedIn,
        openToRehire,
        engagementBreakdown,
        avgEngagementLabel,
        boomerangCounts,
        referralsSubmitted,
        referralsHired,
        referralConversionRate,
        selfApplications,
        pulseResponseRate,
        mostRecentActivity,
        openJobs,
        openThreads,
      });
      setLoadedAt(new Date());
    } catch {
      setError("Failed to load alumni network data.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    loadData();
  }, [companyId, loadData]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Card>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-navy">
            Alumni Network Health
          </h2>
          <p className="text-sm text-mist mt-0.5">
            Live snapshot of your alumni engagement
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Network size={18} className="text-teal" />
          <button
            onClick={loadData}
            className="text-xs text-teal hover:underline flex items-center gap-1"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          {loadedAt && (
            <span className="text-xs text-mist">
              Updated {formatDistanceToNow(loadedAt, { addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 bg-navy/5 rounded" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <p className="text-sm text-ember">{error}</p>
      )}

      {/* Empty */}
      {!loading && !error && data && data.totalAlumni === 0 && (
        <EmptyState
          icon={<Network size={48} strokeWidth={1.5} />}
          title="No alumni yet."
          description="Your alumni network health will appear after the first completed offboarding."
        />
      )}

      {/* Main content */}
      {!loading && !error && data && data.totalAlumni > 0 && (
        <>
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left: Metric list */}
            <div>
              <MetricRow
                label="Total Alumni"
                value={String(data.totalAlumni)}
              />
              <MetricRow
                label="Opted In"
                value={`${data.optedIn} (${data.totalAlumni > 0 ? Math.round((data.optedIn / data.totalAlumni) * 100) : 0}%)`}
              />
              <MetricRow
                label="Open to Rehire"
                value={String(data.openToRehire)}
              />
              <MetricRow
                label="In Boomerang Pipeline"
                value={String(
                  data.boomerangCounts.potential +
                    data.boomerangCounts.contacted +
                    data.boomerangCounts.interviewing
                )}
              />
              <MetricRow
                label="Rehired"
                value={String(data.boomerangCounts.rehired)}
              />
              <MetricRow
                label="Open Jobs Posted"
                value={String(data.openJobs)}
              />
              <MetricRow
                label="Referrals Submitted"
                value={String(data.referralsSubmitted)}
              />
              <MetricRow
                label="Referrals Hired"
                value={
                  data.referralsSubmitted === 0
                    ? "—"
                    : `${data.referralsHired} (${data.referralConversionRate}% conversion)`
                }
              />
              <MetricRow
                label="Self-Applications"
                value={String(data.selfApplications)}
              />
              <MetricRow
                label="Open Expert Threads"
                value={String(data.openThreads)}
              />
              <MetricRow
                label="Avg Re-engagement"
                value={<EngagementDot label={data.avgEngagementLabel} />}
              />
              <MetricRow
                label="Pulse Survey Response"
                value={
                  data.pulseResponseRate !== null
                    ? `${data.pulseResponseRate}%`
                    : "Not sent yet"
                }
              />
              <MetricRow
                label="Most Recent Activity"
                value={
                  data.mostRecentActivity
                    ? `${firstName(data.mostRecentActivity.alumniName)} ${
                        EVENT_LABELS[data.mostRecentActivity.eventType] ??
                        data.mostRecentActivity.eventType
                      } ${formatDistanceToNow(data.mostRecentActivity.createdAt.toDate(), { addSuffix: true })}`
                    : "No activity yet"
                }
                last
              />
            </div>

            {/* Right: Charts */}
            <div>
              {/* Engagement donut */}
              <p className="text-xs font-medium text-mist mb-2">Engagement Levels</p>
              <EngagementDonut breakdown={data.engagementBreakdown} />

              {/* Boomerang funnel */}
              <p className="text-xs font-medium text-mist mb-2 mt-4">Boomerang Pipeline</p>
              <BoomerangFunnel counts={data.boomerangCounts} />
            </div>
          </div>

          {/* Insight callout */}
          <Insight data={data} />
        </>
      )}
    </Card>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  last,
}: {
  label: string;
  value: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex items-baseline justify-between py-2",
        !last && "border-b border-navy/5"
      )}
    >
      <span className="text-sm text-mist">{label}</span>
      <span className="text-sm font-semibold text-navy text-right max-w-[55%]">{value}</span>
    </div>
  );
}

function EngagementDot({ label }: { label: "High" | "Medium" | "Low" | "N/A" }) {
  const dotColor =
    label === "High"
      ? "bg-green-500"
      : label === "Medium"
        ? "bg-yellow-400"
        : label === "Low"
          ? "bg-red-500"
          : "bg-mist";

  return (
    <span className="flex items-center gap-1.5">
      <span className={clsx("w-2 h-2 rounded-full flex-shrink-0", dotColor)} />
      {label}
    </span>
  );
}

function EngagementDonut({
  breakdown,
}: {
  breakdown: { high: number; medium: number; low: number; null: number };
}) {
  const chartData = [
    { name: "High", value: breakdown.high, fill: "#0D9E8A" },
    { name: "Medium", value: breakdown.medium, fill: "#F59E0B" },
    { name: "Low", value: breakdown.low, fill: "#FF6B47" },
    { name: "Unscored", value: breakdown.null, fill: "#E5E7EB" },
  ].filter((d) => d.value > 0);

  if (chartData.length === 0) {
    return <p className="text-xs text-mist">No engagement data yet</p>;
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={140}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={60}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [value, name]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex gap-3 justify-center flex-wrap mt-1">
        {chartData.map((entry) => (
          <span key={entry.name} className="flex items-center gap-1 text-xs text-mist">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.fill }} />
            {entry.name} ({entry.value})
          </span>
        ))}
      </div>
    </>
  );
}

function BoomerangFunnel({
  counts,
}: {
  counts: { potential: number; contacted: number; interviewing: number; rehired: number };
}) {
  const stages = [
    { label: "Potential", value: counts.potential, color: "bg-blue-400" },
    { label: "Contacted", value: counts.contacted, color: "bg-teal/70" },
    { label: "Interviewing", value: counts.interviewing, color: "bg-teal" },
    { label: "Rehired ✓", value: counts.rehired, color: "bg-green-500" },
  ];

  const total = stages.reduce((s, st) => s + st.value, 0);
  if (total === 0) {
    return <p className="text-xs text-mist">No alumni in boomerang pipeline yet.</p>;
  }

  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div>
      {stages.map((stage) => (
        <div key={stage.label} className="flex items-center gap-2 mb-1.5">
          <span className="text-xs text-mist w-20 flex-shrink-0">{stage.label}</span>
          <div className="flex-1 h-4 bg-navy/5 rounded-full overflow-hidden">
            <div
              className={clsx("h-full rounded-full transition-all", stage.color)}
              style={{ width: `${(stage.value / maxValue) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-navy w-4 text-right">{stage.value}</span>
        </div>
      ))}
    </div>
  );
}

function Insight({ data }: { data: AlumniHealthData }) {
  const insight = (() => {
    if (data.engagementBreakdown.high > 0 && data.boomerangCounts.potential === 0)
      return `${data.engagementBreakdown.high} highly engaged alumni aren't in your boomerang pipeline yet. Consider adding them.`;
    if (data.referralsSubmitted > 0 && data.referralConversionRate === 0)
      return `You have ${data.referralsSubmitted} referral${data.referralsSubmitted > 1 ? "s" : ""} pending. Follow up to track hire outcomes.`;
    if (data.pulseResponseRate !== null && data.pulseResponseRate < 30)
      return `Pulse survey response rate is ${data.pulseResponseRate}%. Consider sending a reminder.`;
    if (data.openThreads > 0)
      return `${data.openThreads} expert thread${data.openThreads > 1 ? "s are" : " is"} awaiting alumni response.`;
    if (data.optedIn / Math.max(data.totalAlumni, 1) < 0.5)
      return `Only ${Math.round((data.optedIn / Math.max(data.totalAlumni, 1)) * 100)}% of alumni have opted into the portal. Invite more to grow your network.`;
    return null;
  })();

  if (!insight) return null;

  return (
    <div className="mt-4 pt-4 border-t border-navy/5">
      <p className="text-xs text-mist">
        <span className="text-teal font-medium">💡 Insight: </span>
        {insight}
      </p>
    </div>
  );
}
