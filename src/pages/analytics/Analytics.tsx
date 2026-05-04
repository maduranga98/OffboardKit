import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, subMonths, differenceInDays } from "date-fns";
import { where, orderBy } from "firebase/firestore";
import clsx from "clsx";
import {
  Users,
  CheckCircle,
  TrendingDown,
  Clock,
  BarChart2,
  Plus,
  Filter,
  X,
  Download,
  BookOpen,
} from "lucide-react";

import type { OffboardFlow } from "../../types/offboarding.types";
import type { ExitInterviewResponse } from "../../types/interview.types";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { useAuth } from "../../hooks/useAuth";
import { queryDocuments } from "../../lib/firestore";
import { generateAnalyticsPdf } from "../../lib/pdfExport";

// ─── Types ────────────────────────────────────────────────────────────────────

type DateRange = "30d" | "90d" | "6m" | "1y" | "all" | "custom";

interface DateRangeOption {
  value: DateRange;
  label: string;
}

interface KnowledgeItemBrief {
  id: string;
  companyId: string;
  employeeDepartment?: string;
  status: "draft" | "submitted" | "reviewed";
  hasGap: boolean;
  gapSeverity?: "critical" | "high" | "medium" | "low";
  managerVerified: boolean;
  managerVerificationStatus?: "pending" | "approved" | "rejected";
  gapStatus?: "open" | "resolved";
}

interface FlowTaskBrief {
  id: string;
  flowId: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "overdue" | "skipped";
  dueDate?: { toDate?: () => Date };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_RANGE_OPTIONS: DateRangeOption[] = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" },
];

const PIE_COLORS = [
  "#0D9E8A",
  "#12C4AD",
  "#0F1C2E",
  "#FF6B47",
  "#6B7280",
  "#D1D5DB",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterByDateRange<T extends { createdAt: { toDate?: () => Date } }>(
  items: T[],
  range: DateRange,
  customStart?: Date,
  customEnd?: Date
): T[] {
  if (range === "all") return items;
  const now = new Date();
  let cutoff = new Date();
  let endDate = now;

  if (range === "30d") cutoff.setDate(now.getDate() - 30);
  else if (range === "90d") cutoff.setDate(now.getDate() - 90);
  else if (range === "6m") cutoff.setMonth(now.getMonth() - 6);
  else if (range === "1y") cutoff.setFullYear(now.getFullYear() - 1);
  else if (range === "custom") {
    if (customStart) cutoff = customStart;
    if (customEnd) endDate = customEnd;
  }

  return items.filter((item) => {
    const d = item.createdAt?.toDate?.();
    return d ? d >= cutoff && d <= endDate : false;
  });
}

function getPrevPeriodFlows(flows: OffboardFlow[], range: DateRange): OffboardFlow[] {
  const msMap: Partial<Record<DateRange, number>> = {
    "30d": 30 * 86_400_000,
    "90d": 90 * 86_400_000,
    "6m": 183 * 86_400_000,
    "1y": 365 * 86_400_000,
  };
  const ms = msMap[range];
  if (!ms) return [];
  const now = new Date();
  const currentStart = new Date(now.getTime() - ms);
  const prevEnd = currentStart;
  const prevStart = new Date(prevEnd.getTime() - ms);
  return flows.filter((f) => {
    const d = f.createdAt?.toDate?.();
    return d && d >= prevStart && d < prevEnd;
  });
}

function pctDelta(curr: number, prev: number): string | null {
  if (prev === 0) return null;
  const d = Math.round(((curr - prev) / prev) * 100);
  return `${d >= 0 ? "+" : ""}${d}% vs prev period`;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function scoreColor(value: number): string {
  if (value >= 80) return "text-teal";
  if (value >= 41) return "text-amber-600";
  return "text-ember";
}

function exportFlowsToCsv(flows: OffboardFlow[]) {
  const headers = [
    "Employee", "Role", "Department", "Status", "Progress %",
    "Start Date", "Last Working Day", "Completed On",
    "Tasks Score", "Knowledge Score", "Access Score", "Interview Score", "Assets Score",
  ];
  const rows = flows.map((f) => [
    f.employeeName,
    f.employeeRole,
    f.employeeDepartment,
    f.status,
    f.progressPercent ?? 0,
    f.startDate?.toDate ? format(f.startDate.toDate(), "yyyy-MM-dd") : "",
    f.lastWorkingDay?.toDate ? format(f.lastWorkingDay.toDate(), "yyyy-MM-dd") : "",
    f.completedAt?.toDate ? format(f.completedAt.toDate(), "yyyy-MM-dd") : "",
    f.completionScores?.tasks ?? 0,
    f.completionScores?.knowledge ?? 0,
    f.completionScores?.accessRevocation ?? 0,
    f.completionScores?.exitInterview ?? 0,
    f.completionScores?.assets ?? 0,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics-${format(new Date(), "yyyy-MM-dd")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  iconColor,
  truncate,
  delta,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconColor: "teal" | "ember" | "navy";
  truncate?: boolean;
  delta?: string | null;
}) {
  const iconBg = {
    teal: "bg-teal/10 text-teal",
    ember: "bg-ember/10 text-ember",
    navy: "bg-navy/10 text-navy",
  };

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-mist">{label}</p>
          <p
            className={clsx("mt-1 text-3xl font-semibold text-navy", truncate && "truncate")}
            title={truncate ? value : undefined}
          >
            {value}
          </p>
          {delta && <p className="text-xs text-mist mt-1">{delta}</p>}
        </div>
        <div
          className={clsx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            iconBg[iconColor]
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Analytics() {
  const { companyId } = useAuth();
  const [flows, setFlows] = useState<OffboardFlow[]>([]);
  const [interviewResponses, setInterviewResponses] = useState<ExitInterviewResponse[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItemBrief[]>([]);
  const [flowTasks, setFlowTasks] = useState<FlowTaskBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    if (!companyId) return;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [flowsData, responsesData, knowledgeData] = await Promise.all([
          queryDocuments<OffboardFlow>("offboardFlows", [
            where("companyId", "==", companyId),
            orderBy("createdAt", "desc"),
          ]),
          queryDocuments<ExitInterviewResponse>("exitInterviewResponses", [
            where("companyId", "==", companyId),
            orderBy("createdAt", "desc"),
          ]),
          queryDocuments<KnowledgeItemBrief>("knowledgeItems", [
            where("companyId", "==", companyId),
          ]),
        ]);
        setFlows(flowsData ?? []);
        setInterviewResponses(responsesData ?? []);
        setKnowledgeItems(knowledgeData ?? []);

        // Fetch tasks in batches of 30 (Firestore 'in' limit)
        const flowIds = (flowsData ?? []).map((f) => f.id);
        if (flowIds.length > 0) {
          const BATCH = 30;
          const taskBatches = await Promise.all(
            Array.from({ length: Math.ceil(flowIds.length / BATCH) }, (_, i) =>
              queryDocuments<FlowTaskBrief>("flowTasks", [
                where("flowId", "in", flowIds.slice(i * BATCH, (i + 1) * BATCH)),
              ]).catch(() => [] as FlowTaskBrief[])
            )
          );
          setFlowTasks(taskBatches.flat());
        }
      } catch {
        setError("Failed to load analytics data.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [companyId]);

  // Flows with only department/role filters applied (used for monthly trend chart)
  const deptRoleFilteredFlows = useMemo(() => {
    let result = flows;
    if (selectedDepartments.length > 0)
      result = result.filter((f) => selectedDepartments.includes(f.employeeDepartment));
    if (selectedRoles.length > 0)
      result = result.filter((f) => selectedRoles.includes(f.employeeRole));
    return result;
  }, [flows, selectedDepartments, selectedRoles]);

  // Flows with all filters applied
  const filteredFlows = useMemo(() => {
    const byDate = filterByDateRange(
      deptRoleFilteredFlows,
      dateRange,
      customStartDate ? new Date(customStartDate) : undefined,
      customEndDate ? new Date(customEndDate) : undefined
    );
    return byDate;
  }, [deptRoleFilteredFlows, dateRange, customStartDate, customEndDate]);

  const filteredResponses = useMemo(
    () =>
      filterByDateRange(
        interviewResponses,
        dateRange,
        customStartDate ? new Date(customStartDate) : undefined,
        customEndDate ? new Date(customEndDate) : undefined
      ),
    [interviewResponses, dateRange, customStartDate, customEndDate]
  );

  // Previous period flows (for delta calculation)
  const prevPeriodFlows = useMemo(
    () => getPrevPeriodFlows(flows, dateRange),
    [flows, dateRange]
  );

  // ── KPI metrics ─────────────────────────────────────────────────────────────

  const totalExits = filteredFlows.length;

  const completedFlows = useMemo(
    () => filteredFlows.filter((f) => f.status === "completed"),
    [filteredFlows]
  );

  const avgCompletionRate = useMemo(
    () =>
      completedFlows.length > 0
        ? Math.round(
            completedFlows.reduce((sum, f) => sum + (f.progressPercent ?? 0), 0) /
              completedFlows.length
          )
        : 0,
    [completedFlows]
  );

  const avgDaysToComplete = useMemo(() => {
    const withDates = completedFlows.filter((f) => f.completedAt && f.startDate);
    if (withDates.length === 0) return 0;
    return Math.round(
      withDates.reduce((sum, f) => {
        return sum + Math.abs(differenceInDays(f.completedAt!.toDate(), f.startDate.toDate()));
      }, 0) / withDates.length
    );
  }, [completedFlows]);

  const exitReasonCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredResponses.forEach((r) => {
      r.answers?.forEach((a) => {
        if (a.type === "multiple_choice" && typeof a.value === "string" && a.value) {
          counts[a.value] = (counts[a.value] || 0) + 1;
        }
      });
    });
    return counts;
  }, [filteredResponses]);

  const topExitReason = useMemo(() => {
    const sorted = Object.entries(exitReasonCounts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? "N/A";
  }, [exitReasonCounts]);

  // ── Period-over-period deltas ────────────────────────────────────────────────

  const prevCompletedFlows = prevPeriodFlows.filter((f) => f.status === "completed");

  const prevAvgCompletion =
    prevCompletedFlows.length > 0
      ? Math.round(
          prevCompletedFlows.reduce((s, f) => s + (f.progressPercent ?? 0), 0) /
            prevCompletedFlows.length
        )
      : 0;

  const prevAvgDays = useMemo(() => {
    const withDates = prevCompletedFlows.filter((f) => f.completedAt && f.startDate);
    if (withDates.length === 0) return 0;
    return Math.round(
      withDates.reduce(
        (s, f) =>
          s + Math.abs(differenceInDays(f.completedAt!.toDate(), f.startDate.toDate())),
        0
      ) / withDates.length
    );
  }, [prevCompletedFlows]);

  const exitsDelta = pctDelta(totalExits, prevPeriodFlows.length);
  const completionDelta = pctDelta(avgCompletionRate, prevAvgCompletion);
  const daysDelta = pctDelta(avgDaysToComplete, prevAvgDays);

  // ── Chart data ───────────────────────────────────────────────────────────────

  // Monthly exits: always last 6 months, respects dept/role filters but not date range
  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      const monthKey = format(d, "MMM yyyy");
      const count = deptRoleFilteredFlows.filter((f) => {
        const fd = f.createdAt?.toDate?.();
        return fd && format(fd, "MMM yyyy") === monthKey;
      }).length;
      return { month: format(d, "MMM"), exits: count };
    });
  }, [deptRoleFilteredFlows]);

  const exitReasonData = useMemo(
    () =>
      Object.entries(exitReasonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value]) => ({ name, value })),
    [exitReasonCounts]
  );

  // Department breakdown: uses filteredFlows so date + dept + role filters apply
  const departmentData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredFlows.forEach((f) => {
      const dept = f.employeeDepartment || "Unknown";
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([dept, count]) => ({ dept, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredFlows]);

  // Avg completion scores
  const avgScores = useMemo(() => {
    if (filteredFlows.length === 0)
      return { tasks: 0, accessRevocation: 0, exitInterview: 0, assets: 0, knowledge: 0 };
    return {
      tasks: avg(filteredFlows.map((f) => f.completionScores?.tasks ?? 0)),
      knowledge: avg(filteredFlows.map((f) => f.completionScores?.knowledge ?? 0)),
      accessRevocation: avg(filteredFlows.map((f) => f.completionScores?.accessRevocation ?? 0)),
      exitInterview: avg(filteredFlows.map((f) => f.completionScores?.exitInterview ?? 0)),
      assets: avg(filteredFlows.map((f) => f.completionScores?.assets ?? 0)),
    };
  }, [filteredFlows]);

  // Sentiment breakdown
  const sentimentCounts = useMemo(
    () => ({
      positive: filteredResponses.filter(
        (r) => (r.sentimentLabel || r.sentiment) === "positive"
      ).length,
      neutral: filteredResponses.filter(
        (r) => (r.sentimentLabel || r.sentiment) === "neutral"
      ).length,
      negative: filteredResponses.filter(
        (r) => (r.sentimentLabel || r.sentiment) === "negative"
      ).length,
    }),
    [filteredResponses]
  );

  const aggregatedThemes = useMemo(() => {
    const themeCounts: Record<string, number> = {};
    filteredResponses.forEach((r) => {
      if (r.keyThemes && Array.isArray(r.keyThemes)) {
        r.keyThemes.forEach((theme) => {
          const normalized = theme.toLowerCase().trim();
          themeCounts[normalized] = (themeCounts[normalized] || 0) + 1;
        });
      }
    });
    return Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([theme, count]) => ({ theme, count }));
  }, [filteredResponses]);

  const totalSentimentResponses =
    sentimentCounts.positive + sentimentCounts.neutral + sentimentCounts.negative;

  // Knowledge metrics (company-wide, no date filter)
  const knowledgeStats = useMemo(() => {
    const total = knowledgeItems.length;
    if (total === 0)
      return { total: 0, reviewedPct: 0, gapPct: 0, openGaps: 0, verificationPending: 0 };
    const reviewed = knowledgeItems.filter((i) => i.status === "reviewed").length;
    const withGaps = knowledgeItems.filter((i) => i.hasGap).length;
    const openGaps = knowledgeItems.filter(
      (i) => i.hasGap && i.gapStatus !== "resolved"
    ).length;
    const verificationPending = knowledgeItems.filter(
      (i) =>
        i.managerVerificationStatus === "pending" ||
        (!i.managerVerified && i.status === "reviewed")
    ).length;
    return {
      total,
      reviewedPct: Math.round((reviewed / total) * 100),
      gapPct: Math.round((withGaps / total) * 100),
      openGaps,
      verificationPending,
    };
  }, [knowledgeItems]);

  // Department completion breakdown
  const deptCompletionData = useMemo(() => {
    const groups: Record<string, OffboardFlow[]> = {};
    filteredFlows.forEach((f) => {
      const dept = f.employeeDepartment || "Unknown";
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(f);
    });
    return Object.entries(groups)
      .map(([dept, dFlows]) => ({
        dept,
        count: dFlows.length,
        avgCompletion: avg(dFlows.map((f) => f.progressPercent ?? 0)),
        avgTasks: avg(dFlows.map((f) => f.completionScores?.tasks ?? 0)),
        avgKnowledge: avg(dFlows.map((f) => f.completionScores?.knowledge ?? 0)),
        avgInterview: avg(dFlows.map((f) => f.completionScores?.exitInterview ?? 0)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredFlows]);

  // Gaps by department
  const gapsByDepartment = useMemo(() => {
    const counts: Record<string, { open: number; resolved: number; critical: number; high: number }> = {};
    knowledgeItems.filter((i) => i.hasGap).forEach((i) => {
      const dept = i.employeeDepartment || "Unknown";
      if (!counts[dept]) counts[dept] = { open: 0, resolved: 0, critical: 0, high: 0 };
      if (i.gapStatus === "resolved") {
        counts[dept].resolved++;
      } else {
        counts[dept].open++;
        if (i.gapSeverity === "critical") counts[dept].critical++;
        if (i.gapSeverity === "high") counts[dept].high++;
      }
    });
    return Object.entries(counts)
      .map(([dept, v]) => ({ dept, ...v, total: v.open + v.resolved }))
      .sort((a, b) => b.open - a.open)
      .slice(0, 10);
  }, [knowledgeItems]);

  // Task completion heatmap — top overdue/skipped tasks
  const taskFrequency = useMemo(() => {
    const freq: Record<string, { title: string; overdue: number; skipped: number; total: number }> = {};
    flowTasks.forEach((t) => {
      const key = t.title.trim().toLowerCase();
      if (!freq[key]) freq[key] = { title: t.title.trim(), overdue: 0, skipped: 0, total: 0 };
      freq[key].total++;
      if (t.status === "overdue") freq[key].overdue++;
      else if (t.status === "skipped") freq[key].skipped++;
    });
    return Object.values(freq)
      .filter((r) => r.overdue + r.skipped > 0)
      .sort((a, b) => b.overdue + b.skipped - (a.overdue + a.skipped))
      .slice(0, 10);
  }, [flowTasks]);

  // Recently completed
  const recentCompleted = useMemo(
    () =>
      [...completedFlows]
        .filter((f) => f.completedAt)
        .sort((a, b) => b.completedAt!.toDate().getTime() - a.completedAt!.toDate().getTime())
        .slice(0, 5),
    [completedFlows]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────────

  async function handleExportPdf() {
    if (!companyId) return;
    setExportingPdf(true);
    try {
      await generateAnalyticsPdf({
        companyId,
        dateRange,
        customStartDate,
        customEndDate,
        departments: selectedDepartments.length > 0 ? selectedDepartments : undefined,
        roles: selectedRoles.length > 0 ? selectedRoles : undefined,
      });
    } catch {
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  }

  const activeFilterCount =
    selectedDepartments.length + selectedRoles.length + (dateRange === "custom" ? 1 : 0);

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <EmptyState title="Something went wrong" description={error} />
      </Card>
    );
  }

  if (flows.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display text-navy">Analytics</h1>
          <p className="text-sm text-mist mt-1">Offboarding insights and trends</p>
        </div>
        <Card>
          <EmptyState
            icon={<BarChart2 size={48} strokeWidth={1.5} />}
            title="No data yet"
            description="Analytics will appear after your first offboarding is created."
            action={
              <Link to="/offboardings/new">
                <Button>
                  <Plus size={16} className="mr-1.5" />
                  Start First Offboarding
                </Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-navy">Analytics</h1>
          <p className="text-sm text-mist">Insights across your offboarding processes</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportFlowsToCsv(filteredFlows)}
              disabled={filteredFlows.length === 0}
            >
              <Download size={14} className="mr-1.5" />
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPdf}
              loading={exportingPdf}
              disabled={flows.length === 0}
            >
              <Download size={14} className="mr-1.5" />
              PDF
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setDateRange(opt.value);
                  if (opt.value !== "custom") {
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }
                }}
                className={clsx(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  dateRange === opt.value
                    ? "bg-teal text-white"
                    : "bg-navy/5 text-navy hover:bg-navy/10"
                )}
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5",
                showFilters
                  ? "bg-teal text-white"
                  : "bg-navy/5 text-navy hover:bg-navy/10",
                activeFilterCount > 0 && !showFilters && "ring-2 ring-teal ring-offset-1"
              )}
            >
              <Filter size={14} />
              {activeFilterCount > 0 && (
                <span className="text-xs font-semibold">{activeFilterCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Filters Panel ── */}
      {showFilters && (
        <Card className="bg-navy/5 p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold text-navy">Filters</h3>
            <button
              onClick={() => {
                setShowFilters(false);
                setSelectedDepartments([]);
                setSelectedRoles([]);
                setCustomStartDate("");
                setCustomEndDate("");
              }}
              className="text-mist hover:text-navy transition-colors text-sm"
            >
              Clear all
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {dateRange === "custom" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-navy mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-navy mb-2">Department</label>
              <select
                multiple
                value={selectedDepartments}
                onChange={(e) =>
                  setSelectedDepartments(
                    Array.from(e.target.selectedOptions, (o) => o.value)
                  )
                }
                className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
              >
                {Array.from(new Set(flows.map((f) => f.employeeDepartment)))
                  .filter(Boolean)
                  .sort()
                  .map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
              </select>
              {selectedDepartments.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedDepartments.map((dept) => (
                    <span
                      key={dept}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal/10 text-teal text-xs rounded-full"
                    >
                      {dept}
                      <button
                        onClick={() =>
                          setSelectedDepartments(selectedDepartments.filter((d) => d !== dept))
                        }
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-navy mb-2">Role</label>
              <select
                multiple
                value={selectedRoles}
                onChange={(e) =>
                  setSelectedRoles(Array.from(e.target.selectedOptions, (o) => o.value))
                }
                className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
              >
                {Array.from(new Set(flows.map((f) => f.employeeRole)))
                  .filter(Boolean)
                  .sort()
                  .map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
              </select>
              {selectedRoles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedRoles.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal/10 text-teal text-xs rounded-full"
                    >
                      {role}
                      <button
                        onClick={() =>
                          setSelectedRoles(selectedRoles.filter((r) => r !== role))
                        }
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total Exits"
          value={totalExits.toString()}
          icon={<Users className="h-5 w-5" />}
          iconColor="teal"
          delta={exitsDelta}
        />
        <KpiCard
          label="Avg Completion"
          value={`${avgCompletionRate}%`}
          icon={<CheckCircle className="h-5 w-5" />}
          iconColor="teal"
          delta={completionDelta}
        />
        <KpiCard
          label="Top Exit Reason"
          value={topExitReason}
          icon={<TrendingDown className="h-5 w-5" />}
          iconColor="ember"
          truncate
        />
        <KpiCard
          label="Avg Days to Complete"
          value={`${avgDaysToComplete}d`}
          icon={<Clock className="h-5 w-5" />}
          iconColor="navy"
          delta={daysDelta}
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold text-navy mb-1">
            Monthly Exits
          </h2>
          <p className="text-xs text-mist mb-4">Last 6 months</p>
          {monthlyData.some((d) => d.exits > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0F1C2E" strokeOpacity={0.06} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  allowDecimals={false}
                />
                <Tooltip />
                <Bar dataKey="exits" fill="#0D9E8A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="No exit data yet"
              description="Exit trends will appear here once offboardings are recorded."
            />
          )}
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold text-navy mb-4">Exit Reasons</h2>
          {exitReasonData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={exitReasonData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {exitReasonData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="No exit interview data yet"
              description="Exit reasons appear after employees complete their interviews."
            />
          )}
        </Card>
      </div>

      {/* ── Exits by Department ── */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-navy mb-4">
          Exits by Department
        </h2>
        {departmentData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, departmentData.length * 44)}>
            <BarChart layout="vertical" data={departmentData}>
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="#0F1C2E"
                strokeOpacity={0.06}
              />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6B7280" }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="dept"
                width={110}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6B7280" }}
              />
              <Tooltip />
              <Bar dataKey="count" fill="#0D9E8A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            title="No department data"
            description="Department breakdowns appear once offboarding flows include department information."
          />
        )}
      </Card>

      {/* ── Knowledge Coverage ── */}
      {knowledgeItems.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={18} className="text-teal" />
            <h2 className="font-display text-lg font-semibold text-navy">
              Knowledge Coverage
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
            {(
              [
                { label: "Total Items", value: knowledgeStats.total, color: "text-navy" },
                {
                  label: "Reviewed",
                  value: `${knowledgeStats.reviewedPct}%`,
                  color: knowledgeStats.reviewedPct >= 80 ? "text-teal" : "text-amber-600",
                },
                {
                  label: "Gap Rate",
                  value: `${knowledgeStats.gapPct}%`,
                  color: knowledgeStats.gapPct > 20 ? "text-ember" : "text-navy",
                },
                {
                  label: "Open Gaps",
                  value: knowledgeStats.openGaps,
                  color: knowledgeStats.openGaps > 0 ? "text-ember" : "text-navy",
                },
                {
                  label: "Pending Verification",
                  value: knowledgeStats.verificationPending,
                  color:
                    knowledgeStats.verificationPending > 0 ? "text-amber-600" : "text-navy",
                },
              ] as const
            ).map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className={clsx("text-2xl font-semibold", color)}>{value}</p>
                <p className="text-xs text-mist mt-1">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-navy/5">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-navy/10">
                <div
                  className={clsx(
                    "h-full rounded-full transition-all",
                    knowledgeStats.reviewedPct >= 80
                      ? "bg-teal"
                      : knowledgeStats.reviewedPct >= 40
                        ? "bg-amber-400"
                        : "bg-ember"
                  )}
                  style={{ width: `${knowledgeStats.reviewedPct}%` }}
                />
              </div>
              <span className="text-xs text-mist flex-shrink-0">
                {knowledgeStats.reviewedPct}% reviewed
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* ── Gaps by Department ── */}
      {gapsByDepartment.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={18} className="text-ember" />
            <h2 className="font-display text-lg font-semibold text-navy">
              Knowledge Gaps by Department
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/10">
                  <th className="pb-3 text-left font-medium text-mist">Department</th>
                  <th className="pb-3 text-center font-medium text-mist">Open</th>
                  <th className="pb-3 text-center font-medium text-mist">Resolved</th>
                  <th className="pb-3 text-center font-medium text-mist">Critical</th>
                  <th className="pb-3 text-center font-medium text-mist">High</th>
                  <th className="pb-3 text-left font-medium text-mist w-32">Open rate</th>
                </tr>
              </thead>
              <tbody>
                {gapsByDepartment.map((row) => {
                  const openPct = row.total > 0 ? Math.round((row.open / row.total) * 100) : 0;
                  return (
                    <tr key={row.dept} className="border-b border-navy/5 last:border-0">
                      <td className="py-3 pr-4 font-medium text-navy">{row.dept}</td>
                      <td className="py-3 text-center">
                        <span className={clsx("font-semibold", row.open > 0 ? "text-ember" : "text-navy")}>
                          {row.open}
                        </span>
                      </td>
                      <td className="py-3 text-center text-teal font-semibold">{row.resolved}</td>
                      <td className="py-3 text-center">
                        {row.critical > 0 ? (
                          <span className="font-semibold text-ember">{row.critical}</span>
                        ) : (
                          <span className="text-mist">—</span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        {row.high > 0 ? (
                          <span className="font-semibold text-orange-600">{row.high}</span>
                        ) : (
                          <span className="text-mist">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-navy/10">
                            <div
                              className={clsx("h-full rounded-full", openPct > 50 ? "bg-ember" : "bg-teal")}
                              style={{ width: `${openPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-mist w-8 text-right">{openPct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Task Completion Heatmap ── */}
      {taskFrequency.length > 0 && (
        <Card>
          <h2 className="font-display text-lg font-semibold text-navy mb-1">
            Most Overdue &amp; Skipped Tasks
          </h2>
          <p className="text-xs text-mist mb-4">Tasks most frequently delayed or skipped across all offboardings</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/10">
                  <th className="pb-3 text-left font-medium text-mist">Task</th>
                  <th className="pb-3 text-center font-medium text-mist">Total</th>
                  <th className="pb-3 text-center font-medium text-mist">Overdue</th>
                  <th className="pb-3 text-center font-medium text-mist">Skipped</th>
                  <th className="pb-3 text-left font-medium text-mist w-28">Problem rate</th>
                </tr>
              </thead>
              <tbody>
                {taskFrequency.map((row) => {
                  const problemPct = row.total > 0
                    ? Math.round(((row.overdue + row.skipped) / row.total) * 100)
                    : 0;
                  return (
                    <tr key={row.title} className="border-b border-navy/5 last:border-0">
                      <td className="py-3 pr-4 font-medium text-navy max-w-xs truncate">{row.title}</td>
                      <td className="py-3 text-center text-mist">{row.total}</td>
                      <td className="py-3 text-center">
                        {row.overdue > 0 ? (
                          <span className="font-semibold text-ember">{row.overdue}</span>
                        ) : (
                          <span className="text-mist">—</span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        {row.skipped > 0 ? (
                          <span className="font-semibold text-amber-600">{row.skipped}</span>
                        ) : (
                          <span className="text-mist">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-navy/10">
                            <div
                              className={clsx(
                                "h-full rounded-full",
                                problemPct >= 50 ? "bg-ember" : problemPct >= 25 ? "bg-amber-400" : "bg-teal"
                              )}
                              style={{ width: `${problemPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-mist w-8 text-right">{problemPct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Completion Scores + Sentiment ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold text-navy mb-4">
            Avg Completion Scores
          </h2>
          <div className="space-y-4">
            {(
              [
                { label: "Tasks", value: avgScores.tasks },
                { label: "Knowledge", value: avgScores.knowledge },
                { label: "Access Revocation", value: avgScores.accessRevocation },
                { label: "Exit Interview", value: avgScores.exitInterview },
                { label: "Assets", value: avgScores.assets },
              ] as const
            ).map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-36 text-sm text-mist shrink-0">{row.label}</span>
                <div className="flex-1 h-2 rounded-full bg-navy/10">
                  <div
                    className="h-full rounded-full bg-teal transition-all"
                    style={{ width: `${Math.min(row.value, 100)}%` }}
                  />
                </div>
                <span
                  className={clsx("w-10 text-right text-sm font-semibold", scoreColor(row.value))}
                >
                  {row.value}%
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold text-navy mb-4">
            Exit Interview Sentiment
          </h2>
          {totalSentimentResponses > 0 ? (
            <div className="space-y-4">
              <p className="text-xs text-mist">
                Based on {totalSentimentResponses} response
                {totalSentimentResponses !== 1 ? "s" : ""}
              </p>
              {(
                [
                  {
                    label: "Positive",
                    count: sentimentCounts.positive,
                    variant: "teal" as const,
                    barColor: "bg-teal",
                  },
                  {
                    label: "Neutral",
                    count: sentimentCounts.neutral,
                    variant: "mist" as const,
                    barColor: "bg-navy/20",
                  },
                  {
                    label: "Negative",
                    count: sentimentCounts.negative,
                    variant: "ember" as const,
                    barColor: "bg-ember",
                  },
                ] as const
              ).map((row) => {
                const pct =
                  totalSentimentResponses > 0
                    ? Math.round((row.count / totalSentimentResponses) * 100)
                    : 0;
                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-navy">{row.label}</span>
                        <Badge variant={row.variant}>{row.count}</Badge>
                      </div>
                      <span className="text-sm text-mist">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-navy/10">
                      <div
                        className={clsx("h-full rounded-full transition-all", row.barColor)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {aggregatedThemes.length > 0 && (
                <div className="mt-4 pt-4 border-t border-navy/5">
                  <h3 className="text-xs font-semibold text-mist uppercase tracking-wide mb-2">
                    Top exit themes (AI)
                  </h3>
                  <div className="space-y-2">
                    {aggregatedThemes.map(({ theme, count }) => (
                      <div key={theme} className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-navy/10">
                          <div
                            className="h-full rounded-full bg-teal"
                            style={{
                              width: `${Math.min((count / filteredResponses.length) * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-navy capitalize truncate max-w-[120px]">
                          {theme}
                        </span>
                        <span className="text-xs text-mist flex-shrink-0">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title="No interviews completed yet"
              description="Sentiment analysis will appear after exit interviews are submitted."
            />
          )}
        </Card>
      </div>

      {/* ── Completion by Department ── */}
      {deptCompletionData.length > 1 && (
        <Card>
          <h2 className="font-display text-lg font-semibold text-navy mb-4">
            Completion by Department
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/10">
                  <th className="pb-3 text-left font-medium text-mist">Department</th>
                  <th className="pb-3 text-center font-medium text-mist">Exits</th>
                  <th className="pb-3 text-center font-medium text-mist">Avg Progress</th>
                  <th className="pb-3 text-center font-medium text-mist">Tasks</th>
                  <th className="pb-3 text-center font-medium text-mist">Knowledge</th>
                  <th className="pb-3 text-center font-medium text-mist">Interview</th>
                </tr>
              </thead>
              <tbody>
                {deptCompletionData.map((row) => (
                  <tr key={row.dept} className="border-b border-navy/5 last:border-0">
                    <td className="py-3 pr-4 font-medium text-navy">{row.dept}</td>
                    <td className="py-3 text-center text-mist">{row.count}</td>
                    <td className="py-3 text-center">
                      <span className={clsx("font-semibold", scoreColor(row.avgCompletion))}>
                        {row.avgCompletion}%
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className={clsx("font-semibold", scoreColor(row.avgTasks))}>
                        {row.avgTasks}%
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className={clsx("font-semibold", scoreColor(row.avgKnowledge))}>
                        {row.avgKnowledge}%
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className={clsx("font-semibold", scoreColor(row.avgInterview))}>
                        {row.avgInterview}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Recently Completed ── */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-navy mb-4">
          Recently Completed
        </h2>
        {recentCompleted.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/10">
                  <th className="pb-3 text-left font-medium text-mist">Employee</th>
                  <th className="pb-3 text-left font-medium text-mist">Department</th>
                  <th className="pb-3 text-left font-medium text-mist">Progress</th>
                  <th className="pb-3 text-left font-medium text-mist">Completed On</th>
                </tr>
              </thead>
              <tbody>
                {recentCompleted.map((flow) => (
                  <tr key={flow.id} className="border-b border-navy/5 last:border-0">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal text-white text-xs font-semibold">
                          {(flow.employeeName ?? "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-navy">{flow.employeeName}</p>
                          <p className="text-xs text-mist">{flow.employeeRole}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="mist">{flow.employeeDepartment ?? "—"}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-navy/10">
                          <div
                            className="h-full rounded-full bg-teal"
                            style={{ width: `${Math.min(flow.progressPercent ?? 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-mist">{flow.progressPercent ?? 0}%</span>
                      </div>
                    </td>
                    <td className="py-3 text-mist">
                      {flow.completedAt?.toDate
                        ? format(flow.completedAt.toDate(), "MMM d, yyyy")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No completed offboardings yet"
            description="Completed offboardings will appear here once employees finish their offboarding process."
          />
        )}
      </Card>
    </div>
  );
}
