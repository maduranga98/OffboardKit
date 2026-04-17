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

type DateRange = "30d" | "90d" | "6m" | "1y" | "all" | "custom";

interface DateRangeOption {
  value: DateRange;
  label: string;
}

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

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function scoreColor(value: number): string {
  if (value >= 80) return "text-teal";
  if (value >= 41) return "text-amber-600";
  return "text-ember";
}

export default function Analytics() {
  const { companyId } = useAuth();
  const [flows, setFlows] = useState<OffboardFlow[]>([]);
  const [interviewResponses, setInterviewResponses] = useState<
    ExitInterviewResponse[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedExitTypes, setSelectedExitTypes] = useState<string[]>([]);
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
        const [flowsData, responsesData] = await Promise.all([
          queryDocuments<OffboardFlow>("offboardFlows", [
            where("companyId", "==", companyId),
            orderBy("createdAt", "desc"),
          ]),
          queryDocuments<ExitInterviewResponse>("exitInterviewResponses", [
            where("companyId", "==", companyId),
            orderBy("createdAt", "desc"),
          ]),
        ]);
        setFlows(flowsData ?? []);
        setInterviewResponses(responsesData ?? []);
      } catch (err) {
        setError("Failed to load analytics data.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [companyId]);

  const filteredFlows = useMemo(() => {
    let result = filterByDateRange(
      flows,
      dateRange,
      customStartDate ? new Date(customStartDate) : undefined,
      customEndDate ? new Date(customEndDate) : undefined
    );

    if (selectedDepartments.length > 0) {
      result = result.filter((f) => selectedDepartments.includes(f.employeeDepartment));
    }
    if (selectedRoles.length > 0) {
      result = result.filter((f) => selectedRoles.includes(f.employeeRole));
    }
    if (selectedExitTypes.length > 0) {
      result = result.filter((f) => {
        const flowExitType = f.employeeDepartment;
        return selectedExitTypes.some((et) => flowExitType?.includes(et));
      });
    }

    return result;
  }, [flows, dateRange, customStartDate, customEndDate, selectedDepartments, selectedRoles, selectedExitTypes]);

  const filteredResponses = useMemo(
    () => filterByDateRange(
      interviewResponses,
      dateRange,
      customStartDate ? new Date(customStartDate) : undefined,
      customEndDate ? new Date(customEndDate) : undefined
    ),
    [interviewResponses, dateRange, customStartDate, customEndDate]
  );

  // KPI metrics
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

  // Top exit reason from interview multiple_choice answers
  const exitReasonCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredResponses.forEach((r) => {
      r.answers?.forEach((a) => {
        if (
          a.type === "multiple_choice" &&
          typeof a.value === "string" &&
          a.value
        ) {
          counts[a.value] = (counts[a.value] || 0) + 1;
        }
      });
    });
    return counts;
  }, [filteredResponses]);

  const topExitReason = useMemo(() => {
    const sorted = Object.entries(exitReasonCounts).sort(
      (a, b) => b[1] - a[1]
    );
    return sorted[0]?.[0] ?? "N/A";
  }, [exitReasonCounts]);

  // Avg days to complete
  const avgDaysToComplete = useMemo(() => {
    const completedWithDates = completedFlows.filter(
      (f) => f.completedAt && f.startDate
    );
    if (completedWithDates.length === 0) return 0;
    return Math.round(
      completedWithDates.reduce((sum, f) => {
        const start = f.startDate.toDate();
        const end = f.completedAt!.toDate();
        return sum + Math.abs(differenceInDays(end, start));
      }, 0) / completedWithDates.length
    );
  }, [completedFlows]);

  // Monthly exits (always last 6 months, unfiltered)
  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      const label = format(d, "MMM");
      const monthKey = format(d, "MMM yyyy");
      const count = flows.filter((f) => {
        const fd = f.createdAt?.toDate?.();
        return fd && format(fd, "MMM yyyy") === monthKey;
      }).length;
      return { month: label, exits: count };
    });
  }, [flows]);

  // Exit reasons pie chart data
  const exitReasonData = useMemo(
    () =>
      Object.entries(exitReasonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value]) => ({ name, value })),
    [exitReasonCounts]
  );

  // Department breakdown — ALL flows, not just filtered
  const departmentData = useMemo(() => {
    const counts: Record<string, number> = {};
    flows.forEach((f) => {
      const dept = f.employeeDepartment || "Unknown";
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([dept, count]) => ({ dept, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [flows]);

  // Avg completion scores
  const avgScores = useMemo(() => {
    if (filteredFlows.length === 0) {
      return { tasks: 0, accessRevocation: 0, exitInterview: 0, assets: 0 };
    }
    return {
      tasks: avg(filteredFlows.map((f) => f.completionScores?.tasks ?? 0)),
      accessRevocation: avg(
        filteredFlows.map((f) => f.completionScores?.accessRevocation ?? 0)
      ),
      exitInterview: avg(
        filteredFlows.map((f) => f.completionScores?.exitInterview ?? 0)
      ),
      assets: avg(filteredFlows.map((f) => f.completionScores?.assets ?? 0)),
    };
  }, [filteredFlows]);

  // Sentiment breakdown — prefer AI sentimentLabel when available
  const sentimentCounts = useMemo(
    () => ({
      positive: filteredResponses.filter((r) => (r.sentimentLabel || r.sentiment) === "positive")
        .length,
      neutral: filteredResponses.filter((r) => (r.sentimentLabel || r.sentiment) === "neutral")
        .length,
      negative: filteredResponses.filter((r) => (r.sentimentLabel || r.sentiment) === "negative")
        .length,
    }),
    [filteredResponses]
  );

  // Aggregate AI themes across all responses
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

  // Recent completed flows
  const recentCompleted = useMemo(
    () =>
      [...completedFlows]
        .filter((f) => f.completedAt)
        .sort((a, b) => {
          const aDate = a.completedAt!.toDate().getTime();
          const bDate = b.completedAt!.toDate().getTime();
          return bDate - aDate;
        })
        .slice(0, 5),
    [completedFlows]
  );

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
        <EmptyState
          title="Something went wrong"
          description={error}
        />
      </Card>
    );
  }

  if (!loading && flows.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display text-navy">Analytics</h1>
          <p className="text-sm text-mist mt-1">
            Offboarding insights and trends
          </p>
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

  const activeFilterCount = selectedDepartments.length + selectedRoles.length + selectedExitTypes.length + (dateRange === "custom" ? 1 : 0);

  async function handleExportPdf() {
    if (!companyId) return;
    setExportingPdf(true);
    try {
      await generateAnalyticsPdf({
        companyId,
        dateRange,
        customStartDate,
        customEndDate,
      });
    } catch (err) {
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-navy">Analytics</h1>
          <p className="text-sm text-mist">
            Insights across your offboarding processes
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportPdf}
            loading={exportingPdf}
            disabled={flows.length === 0}
          >
            <Download size={14} className="mr-1.5" />
            Export PDF
          </Button>
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
            {activeFilterCount > 0 && <span className="text-xs font-semibold">{activeFilterCount}</span>}
          </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="bg-navy/5 p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold text-navy">Filters</h3>
            <button
              onClick={() => {
                setShowFilters(false);
                setSelectedDepartments([]);
                setSelectedRoles([]);
                setSelectedExitTypes([]);
                setCustomStartDate("");
                setCustomEndDate("");
              }}
              className="text-mist hover:text-navy transition-colors"
            >
              Clear all
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Custom Date Range */}
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

            {/* Department Filter */}
            <div>
              <label className="block text-sm font-medium text-navy mb-2">
                Department
              </label>
              <select
                multiple
                value={selectedDepartments}
                onChange={(e) => setSelectedDepartments(Array.from(e.target.selectedOptions, (o) => o.value))}
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
                        onClick={() => setSelectedDepartments(selectedDepartments.filter((d) => d !== dept))}
                        className="hover:text-navy transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-navy mb-2">
                Role
              </label>
              <select
                multiple
                value={selectedRoles}
                onChange={(e) => setSelectedRoles(Array.from(e.target.selectedOptions, (o) => o.value))}
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
                        onClick={() => setSelectedRoles(selectedRoles.filter((r) => r !== role))}
                        className="hover:text-navy transition-colors"
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

      {/* Section 1: KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total Exits"
          value={totalExits.toString()}
          icon={<Users className="h-5 w-5" />}
          iconColor="teal"
        />
        <KpiCard
          label="Avg Completion"
          value={`${avgCompletionRate}%`}
          icon={<CheckCircle className="h-5 w-5" />}
          iconColor="teal"
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
          value={`${avgDaysToComplete} days`}
          icon={<Clock className="h-5 w-5" />}
          iconColor="navy"
        />
      </div>

      {/* Section 2: Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Exits Bar Chart */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-navy mb-4">
            Monthly Exits
          </h2>
          {monthlyData.some((d) => d.exits > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#0F1C2E"
                  strokeOpacity={0.06}
                />
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

        {/* Exit Reasons Pie Chart */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-navy mb-4">
            Exit Reasons
          </h2>
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
                    <Cell
                      key={idx}
                      fill={PIE_COLORS[idx % PIE_COLORS.length]}
                    />
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

      {/* Section 3: Department Turnover */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-navy mb-4">
          Exits by Department
        </h2>
        {departmentData.length > 0 ? (
          <ResponsiveContainer
            width="100%"
            height={Math.max(200, departmentData.length * 44)}
          >
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
            title="No department data yet"
            description="Department breakdowns will appear once offboarding flows have department information."
          />
        )}
      </Card>

      {/* Section 4: Completion Scores + Sentiment */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Avg Completion Scores */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-navy mb-4">
            Avg Completion Scores
          </h2>
          <div className="space-y-4">
            {(
              [
                { label: "Tasks", value: avgScores.tasks },
                { label: "Access Revocation", value: avgScores.accessRevocation },
                { label: "Exit Interview", value: avgScores.exitInterview },
                { label: "Assets", value: avgScores.assets },
              ] as const
            ).map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-36 text-sm text-mist shrink-0">
                  {row.label}
                </span>
                <div className="flex-1 h-2 rounded-full bg-navy/10">
                  <div
                    className="h-full rounded-full bg-teal transition-all"
                    style={{ width: `${Math.min(row.value, 100)}%` }}
                  />
                </div>
                <span
                  className={clsx(
                    "w-10 text-right text-sm font-semibold",
                    scoreColor(row.value)
                  )}
                >
                  {row.value}%
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Exit Interview Sentiment */}
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
                        className={clsx(
                          "h-full rounded-full transition-all",
                          row.barColor
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {/* Top AI Themes */}
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
                        <span className="text-xs text-navy capitalize min-w-0 truncate max-w-[120px]">
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

      {/* Section 5: Recent Completed Offboardings */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-navy mb-4">
          Recently Completed
        </h2>
        {recentCompleted.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/10">
                  <th className="pb-3 text-left font-medium text-mist">
                    Employee
                  </th>
                  <th className="pb-3 text-left font-medium text-mist">
                    Department
                  </th>
                  <th className="pb-3 text-left font-medium text-mist">
                    Progress
                  </th>
                  <th className="pb-3 text-left font-medium text-mist">
                    Completed On
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentCompleted.map((flow) => (
                  <tr
                    key={flow.id}
                    className="border-b border-navy/5 last:border-0"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal text-white text-xs font-semibold">
                          {(flow.employeeName ?? "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-navy">
                            {flow.employeeName}
                          </p>
                          <p className="text-xs text-mist">
                            {flow.employeeRole}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="mist">
                        {flow.employeeDepartment ?? "—"}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-navy/10">
                          <div
                            className="h-full rounded-full bg-teal"
                            style={{
                              width: `${Math.min(flow.progressPercent ?? 0, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-mist">
                          {flow.progressPercent ?? 0}%
                        </span>
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

function KpiCard({
  label,
  value,
  icon,
  iconColor,
  truncate,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconColor: "teal" | "ember" | "navy";
  truncate?: boolean;
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
            className={clsx(
              "mt-1 text-3xl font-semibold text-navy",
              truncate && "truncate"
            )}
            title={truncate ? value : undefined}
          >
            {value}
          </p>
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
