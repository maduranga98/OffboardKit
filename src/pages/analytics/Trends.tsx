import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";
import { where, orderBy } from "firebase/firestore";
import {
  TrendingUp,
  AlertTriangle,
  Tag,
  Building2,
  MessageSquare,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { useAuth } from "../../hooks/useAuth";
import { queryDocuments } from "../../lib/firestore";
import type { ExitInterviewResponse } from "../../types/interview.types";

type RangeKey = "3m" | "6m" | "12m" | "all";

const RANGES: { key: RangeKey; label: string; months: number | null }[] = [
  { key: "3m", label: "3 months", months: 3 },
  { key: "6m", label: "6 months", months: 6 },
  { key: "12m", label: "12 months", months: 12 },
  { key: "all", label: "All time", months: null },
];

function sentimentToScore(s?: string): number | null {
  if (s === "positive") return 1;
  if (s === "neutral") return 0;
  if (s === "negative") return -1;
  return null;
}

function classifyScore(avg: number): "positive" | "neutral" | "negative" {
  if (avg > 0.2) return "positive";
  if (avg < -0.2) return "negative";
  return "neutral";
}

function bucketKey(d: Date): string {
  return format(startOfMonth(d), "yyyy-MM");
}

function KpiCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "teal" | "ember" | "mist" | "amber";
  icon: React.ReactNode;
}) {
  const toneMap: Record<string, string> = {
    teal: "text-teal",
    ember: "text-ember",
    mist: "text-mist",
    amber: "text-amber",
  };
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-mist">{label}</p>
          <p className="text-2xl font-display text-navy mt-1">{value}</p>
          {hint && <p className="text-xs text-mist mt-1">{hint}</p>}
        </div>
        <div className={toneMap[tone]}>{icon}</div>
      </div>
    </Card>
  );
}

export default function Trends() {
  const { companyId } = useAuth();
  const [responses, setResponses] = useState<ExitInterviewResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("12m");

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await queryDocuments<ExitInterviewResponse>(
          "exitInterviewResponses",
          [
            where("companyId", "==", companyId),
            orderBy("submittedAt", "desc"),
          ]
        );
        if (!cancelled) setResponses(rows);
      } catch (err) {
        console.error("Trends load failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // Range filter
  const filtered = useMemo(() => {
    const config = RANGES.find((r) => r.key === range)!;
    if (config.months == null) return responses;
    const cutoff = subMonths(new Date(), config.months);
    return responses.filter((r) => {
      const d = r.submittedAt?.toDate?.();
      return d && d >= cutoff;
    });
  }, [responses, range]);

  // Sentiment trend (monthly)
  const sentimentTrend = useMemo(() => {
    const months = new Map<
      string,
      { scores: number[]; pos: number; neu: number; neg: number }
    >();
    const cfg = RANGES.find((r) => r.key === range)!;
    const horizonStart = cfg.months
      ? startOfMonth(subMonths(new Date(), cfg.months - 1))
      : null;
    // Seed monthly buckets so the line continues through empty months.
    if (horizonStart) {
      for (let i = 0; i < (cfg.months ?? 0); i++) {
        const d = new Date(horizonStart);
        d.setMonth(d.getMonth() + i);
        months.set(bucketKey(d), { scores: [], pos: 0, neu: 0, neg: 0 });
      }
    }
    for (const r of filtered) {
      const d = r.submittedAt?.toDate?.();
      if (!d) continue;
      const key = bucketKey(d);
      const cell =
        months.get(key) || { scores: [], pos: 0, neu: 0, neg: 0 };
      const s = r.sentimentLabel ?? r.sentiment;
      const score = sentimentToScore(s);
      if (score != null) cell.scores.push(score);
      if (s === "positive") cell.pos++;
      else if (s === "negative") cell.neg++;
      else cell.neu++;
      months.set(key, cell);
    }
    return Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({
        month: format(new Date(key + "-01"), "MMM yyyy"),
        avgScore:
          v.scores.length > 0
            ? Math.round(
                (v.scores.reduce((s, x) => s + x, 0) / v.scores.length) * 100
              ) / 100
            : null,
        positive: v.pos,
        neutral: v.neu,
        negative: v.neg,
        responses: v.pos + v.neu + v.neg,
      }));
  }, [filtered, range]);

  // Department breakdown
  const departmentData = useMemo(() => {
    const groups = new Map<
      string,
      { pos: number; neu: number; neg: number; total: number; scoreSum: number }
    >();
    for (const r of filtered) {
      const dept = r.employeeDepartment || "Unspecified";
      const g =
        groups.get(dept) ||
        { pos: 0, neu: 0, neg: 0, total: 0, scoreSum: 0 };
      const s = r.sentimentLabel ?? r.sentiment;
      if (s === "positive") g.pos++;
      else if (s === "negative") g.neg++;
      else g.neu++;
      g.total++;
      const score = sentimentToScore(s);
      if (score != null) g.scoreSum += score;
      groups.set(dept, g);
    }
    return Array.from(groups.entries())
      .map(([dept, g]) => ({
        dept,
        positive: g.pos,
        neutral: g.neu,
        negative: g.neg,
        total: g.total,
        avg: g.total > 0 ? g.scoreSum / g.total : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Top themes from AI keyThemes
  const topThemes = useMemo(() => {
    const counts = new Map<string, { count: number; sentiments: number[] }>();
    for (const r of filtered) {
      const themes = r.keyThemes ?? [];
      const score = sentimentToScore(r.sentimentLabel ?? r.sentiment);
      for (const raw of themes) {
        const t = String(raw).trim();
        if (!t) continue;
        const key = t.toLowerCase();
        const cell = counts.get(key) || { count: 0, sentiments: [] };
        cell.count++;
        if (score != null) cell.sentiments.push(score);
        counts.set(key, cell);
      }
    }
    return Array.from(counts.entries())
      .map(([key, v]) => ({
        theme: key.replace(/\b\w/g, (c) => c.toUpperCase()),
        count: v.count,
        avgSentiment:
          v.sentiments.length > 0
            ? v.sentiments.reduce((s, x) => s + x, 0) / v.sentiments.length
            : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filtered]);

  // Top risk flags
  const topRiskFlags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of filtered) {
      for (const raw of r.riskFlags ?? []) {
        const flag = String(raw).trim();
        if (!flag) continue;
        counts.set(flag, (counts.get(flag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [filtered]);

  // KPIs
  const totalResponses = filtered.length;
  const positiveCount = filtered.filter(
    (r) => (r.sentimentLabel ?? r.sentiment) === "positive"
  ).length;
  const negativeCount = filtered.filter(
    (r) => (r.sentimentLabel ?? r.sentiment) === "negative"
  ).length;
  const flaggedCount = filtered.filter(
    (r) => (r.riskFlags?.length ?? 0) > 0
  ).length;
  const positivePct =
    totalResponses > 0
      ? Math.round((positiveCount / totalResponses) * 100)
      : 0;
  const negativePct =
    totalResponses > 0
      ? Math.round((negativeCount / totalResponses) * 100)
      : 0;

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display text-navy">Exit Interview Trends</h1>
          <p className="text-sm text-mist mt-1">
            Sentiment, themes, and risk signals across submitted exit interviews.
          </p>
        </div>
        <div className="flex gap-1 bg-navy/5 rounded-md p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors " +
                (range === r.key
                  ? "bg-white text-navy shadow-sm"
                  : "text-mist hover:text-navy")
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {totalResponses === 0 ? (
        <Card>
          <EmptyState
            icon={<MessageSquare size={48} strokeWidth={1.5} />}
            title="No exit interviews in this range"
            description="Submitted exit interviews will populate trends, themes, and risk flags here."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Responses"
              value={String(totalResponses)}
              tone="mist"
              icon={<MessageSquare size={20} />}
            />
            <KpiCard
              label="Positive"
              value={`${positivePct}%`}
              hint={`${positiveCount} responses`}
              tone="teal"
              icon={<TrendingUp size={20} />}
            />
            <KpiCard
              label="Negative"
              value={`${negativePct}%`}
              hint={`${negativeCount} responses`}
              tone="ember"
              icon={<TrendingUp size={20} className="rotate-180" />}
            />
            <KpiCard
              label="With risk flags"
              value={String(flaggedCount)}
              hint={`${
                totalResponses > 0
                  ? Math.round((flaggedCount / totalResponses) * 100)
                  : 0
              }% of responses`}
              tone="amber"
              icon={<AlertTriangle size={20} />}
            />
          </div>

          <Card>
            <h2 className="text-base font-semibold text-navy mb-4">
              Sentiment over time
            </h2>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <LineChart
                  data={sentimentTrend}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                  />
                  <YAxis
                    yAxisId="score"
                    domain={[-1, 1]}
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                    label={{
                      value: "Avg sentiment",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 11, fill: "#6B7280" },
                    }}
                  />
                  <YAxis
                    yAxisId="count"
                    orientation="right"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                  />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    yAxisId="score"
                    type="monotone"
                    dataKey="avgScore"
                    name="Avg sentiment (-1..1)"
                    stroke="#0D9E8A"
                    strokeWidth={2}
                    connectNulls
                    dot={{ r: 3 }}
                  />
                  <Line
                    yAxisId="count"
                    type="monotone"
                    dataKey="responses"
                    name="Responses"
                    stroke="#0F1C2E"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={16} className="text-navy" />
                <h2 className="text-base font-semibold text-navy">
                  By department
                </h2>
              </div>
              {departmentData.length === 0 ? (
                <p className="text-sm text-mist py-8 text-center">
                  No department data.
                </p>
              ) : (
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={departmentData}
                      layout="vertical"
                      margin={{ top: 4, right: 20, left: 20, bottom: 0 }}
                    >
                      <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#6B7280" }} />
                      <YAxis
                        type="category"
                        dataKey="dept"
                        width={110}
                        tick={{ fontSize: 11, fill: "#0F1C2E" }}
                      />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="positive" stackId="s" fill="#0D9E8A" name="Positive" />
                      <Bar dataKey="neutral" stackId="s" fill="#9CA3AF" name="Neutral" />
                      <Bar dataKey="negative" stackId="s" fill="#DC2626" name="Negative" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Tag size={16} className="text-navy" />
                <h2 className="text-base font-semibold text-navy">
                  Top themes
                </h2>
              </div>
              {topThemes.length === 0 ? (
                <p className="text-sm text-mist py-8 text-center">
                  AI hasn't extracted themes yet. Themes appear after exit
                  interviews are submitted and analyzed.
                </p>
              ) : (
                <ul className="space-y-2">
                  {topThemes.map((t) => {
                    const tone = classifyScore(t.avgSentiment);
                    return (
                      <li
                        key={t.theme}
                        className="flex items-center justify-between gap-3 border-b border-navy/5 pb-2 last:border-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm text-navy truncate">
                            {t.theme}
                          </span>
                          <Badge
                            variant={
                              tone === "positive"
                                ? "teal"
                                : tone === "negative"
                                ? "ember"
                                : "mist"
                            }
                          >
                            {tone}
                          </Badge>
                        </div>
                        <span className="text-sm font-medium text-navy whitespace-nowrap">
                          {t.count}×
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-amber" />
              <h2 className="text-base font-semibold text-navy">
                Risk flags raised
              </h2>
            </div>
            {topRiskFlags.length === 0 ? (
              <p className="text-sm text-mist py-6 text-center">
                No risk flags raised in this range.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {topRiskFlags.map(([flag, count]) => (
                  <div
                    key={flag}
                    className="flex items-center justify-between gap-3 rounded-md border border-navy/5 px-3 py-2"
                  >
                    <span className="text-sm text-navy truncate">{flag}</span>
                    <Badge variant="amber">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
