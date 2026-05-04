import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  CalendarClock,
  BookOpen,
  AlertTriangle,
  Plus,
  FileText,
  ArrowRight,
  CheckCircle,
  Clock,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  differenceInDays,
} from "date-fns";
import clsx from "clsx";
import { where, orderBy, Timestamp } from "firebase/firestore";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Progress } from "../../components/ui/Progress";
import { EmptyState } from "../../components/shared/EmptyState";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToCollection, queryDocuments } from "../../lib/firestore";
import { showToast } from "../../components/ui/Toast";
import type { OffboardFlow, FlowTask } from "../../types/offboarding.types";

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  highlight?: boolean;
  to?: string;
}

interface ActivityItem {
  id: string;
  type: "task_completed" | "offboarding_started" | "knowledge_submitted";
  title: string;
  subtitle: string;
  timestamp: Date;
  icon: "check" | "user" | "book";
}

interface KnowledgeItemBrief {
  id: string;
  companyId: string;
  title: string;
  hasGap: boolean;
  gapStatus?: "open" | "resolved";
  createdAt: Timestamp;
}

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return format(date, "MMM d");
}

function daysRemaining(lwd: Date): { label: string; urgent: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = differenceInDays(lwd, today);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, urgent: true };
  if (diff === 0) return { label: "Today", urgent: true };
  if (diff === 1) return { label: "Tomorrow", urgent: true };
  return { label: `${diff}d left`, urgent: diff <= 3 };
}

function StatCard({ label, value, icon, color, highlight, to }: StatCardProps) {
  const content = (
    <Card className={clsx(to && "hover:ring-1 hover:ring-teal/40 transition-shadow cursor-pointer")}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-mist">{label}</p>
          <p
            className={clsx(
              "text-3xl font-semibold mt-1",
              highlight && value > 0 ? "text-ember" : "text-navy"
            )}
          >
            {value}
          </p>
        </div>
        <div className={clsx("p-2 rounded-md", color)}>{icon}</div>
      </div>
    </Card>
  );

  if (to) return <Link to={to}>{content}</Link>;
  return content;
}

// Load pending/completed tasks for a set of flow IDs, batching by 30 (Firestore `in` limit)
async function loadTasksForFlows(flowIds: string[]): Promise<{
  pending: FlowTask[];
  completed: FlowTask[];
}> {
  const pending: FlowTask[] = [];
  const completed: FlowTask[] = [];

  for (let i = 0; i < flowIds.length; i += 30) {
    const batch = flowIds.slice(i, i + 30);
    const [batchPending, batchCompleted] = await Promise.all([
      queryDocuments<FlowTask>("flowTasks", [
        where("flowId", "in", batch),
        where("status", "in", ["pending", "in_progress"]),
      ]),
      queryDocuments<FlowTask>("flowTasks", [
        where("flowId", "in", batch),
        where("status", "==", "completed"),
      ]),
    ]);
    pending.push(...batchPending);
    completed.push(...batchCompleted);
  }

  return { pending, completed };
}

export default function Dashboard() {
  const { appUser, companyId } = useAuth();
  const [flows, setFlows] = useState<OffboardFlow[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItemBrief[]>([]);
  const [overdueTasks, setOverdueTasks] = useState(0);
  const [recentTasks, setRecentTasks] = useState<FlowTask[]>([]);
  const [flowsLoading, setFlowsLoading] = useState(true);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  const refreshTasks = useCallback(async (activeFlowIds: string[]) => {
    if (activeFlowIds.length === 0) {
      setOverdueTasks(0);
      setRecentTasks([]);
      return;
    }
    try {
      const now = new Date();
      const { pending, completed } = await loadTasksForFlows(activeFlowIds);
      setOverdueTasks(pending.filter((t) => {
        const d = toDate(t.dueDate);
        return d && d < now;
      }).length);
      setRecentTasks(completed);
    } catch {
      // Non-fatal — overdue count stays at last known value
    }
  }, []);

  useEffect(() => {
    if (!companyId) return;

    const unsubFlows = subscribeToCollection<OffboardFlow>(
      "offboardFlows",
      [where("companyId", "==", companyId), orderBy("createdAt", "desc")],
      (data) => {
        setFlows(data);
        setFlowsLoading(false);
        const activeIds = data
          .filter((f) => f.status === "in_progress" || f.status === "not_started")
          .map((f) => f.id);
        refreshTasks(activeIds).catch(() =>
          showToast("error", "Failed to load task data")
        );
      }
    );

    const unsubKnowledge = subscribeToCollection<KnowledgeItemBrief>(
      "knowledgeItems",
      [where("companyId", "==", companyId), orderBy("createdAt", "desc")],
      (data) => {
        setKnowledgeItems(data);
      }
    );

    return () => {
      unsubFlows();
      unsubKnowledge();
    };
  }, [companyId, refreshTasks]);

  // Derived stats
  const activeFlows = useMemo(
    () => flows.filter((f) => f.status === "in_progress" || f.status === "not_started"),
    [flows]
  );

  // Sort active flows by lastWorkingDay ascending (soonest first)
  const sortedActiveFlows = useMemo(
    () =>
      [...activeFlows].sort((a, b) => {
        const aDate = toDate(a.lastWorkingDay)?.getTime() ?? Infinity;
        const bDate = toDate(b.lastWorkingDay)?.getTime() ?? Infinity;
        return aDate - bDate;
      }),
    [activeFlows]
  );

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const completingThisWeek = useMemo(
    () =>
      activeFlows.filter((f) => {
        const lwd = toDate(f.lastWorkingDay);
        return lwd && isWithinInterval(lwd, { start: weekStart, end: weekEnd });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeFlows]
  );

  // Flows leaving within next 7 days (including today)
  const leavingSoon = useMemo(
    () =>
      sortedActiveFlows.filter((f) => {
        const lwd = toDate(f.lastWorkingDay);
        if (!lwd) return false;
        const diff = differenceInDays(lwd, now);
        return diff >= 0 && diff <= 7;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedActiveFlows]
  );

  const openGaps = useMemo(
    () => knowledgeItems.filter((k) => k.hasGap && k.gapStatus !== "resolved").length,
    [knowledgeItems]
  );

  // Activity feed assembled from real-time state
  const activities = useMemo((): ActivityItem[] => {
    const items: ActivityItem[] = [];

    flows.slice(0, 5).forEach((flow) => {
      const createdAt = toDate(flow.createdAt);
      if (createdAt) {
        items.push({
          id: `flow-${flow.id}`,
          type: "offboarding_started",
          title: "Offboarding started",
          subtitle: `${flow.employeeName} · ${flow.employeeRole}`,
          timestamp: createdAt,
          icon: "user",
        });
      }
    });

    recentTasks
      .filter((t) => t.completedAt)
      .sort((a, b) => {
        const aD = toDate(a.completedAt);
        const bD = toDate(b.completedAt);
        return (bD?.getTime() ?? 0) - (aD?.getTime() ?? 0);
      })
      .slice(0, 10)
      .forEach((task) => {
        const completedAt = toDate(task.completedAt);
        if (completedAt) {
          items.push({
            id: `task-${task.id}`,
            type: "task_completed",
            title: "Task completed",
            subtitle: task.title,
            timestamp: completedAt,
            icon: "check",
          });
        }
      });

    knowledgeItems.slice(0, 5).forEach((item) => {
      const createdAt = toDate(item.createdAt);
      if (createdAt) {
        items.push({
          id: `knowledge-${item.id}`,
          type: "knowledge_submitted",
          title: "Knowledge item added",
          subtitle: item.title || "Untitled",
          timestamp: createdAt,
          icon: "book",
        });
      }
    });

    return items
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 8);
  }, [flows, recentTasks, knowledgeItems]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display text-navy">
            {greeting}, {appUser?.displayName?.split(" ")[0] || "there"}
          </h1>
          <p className="text-sm text-mist mt-1">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/offboardings/new">
            <Button>
              <Plus size={16} className="mr-1.5" />
              New Offboarding
            </Button>
          </Link>
          <Link to="/templates">
            <Button variant="outline">
              <FileText size={16} className="mr-1.5" />
              Create Template
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Offboardings"
          value={activeFlows.length}
          icon={<Users size={20} className="text-teal" />}
          color="bg-teal/10"
          to="/offboardings"
        />
        <StatCard
          label="Completing This Week"
          value={completingThisWeek.length}
          icon={<CalendarClock size={20} className="text-amber-600" />}
          color="bg-amber-100"
        />
        <StatCard
          label="Open Knowledge Gaps"
          value={openGaps}
          icon={<BookOpen size={20} className="text-blue-600" />}
          color="bg-blue-50"
          highlight={openGaps > 0}
          to="/knowledge/gaps"
        />
        <StatCard
          label="Overdue Tasks"
          value={overdueTasks}
          icon={<AlertTriangle size={20} className="text-ember" />}
          color="bg-ember/10"
          highlight
        />
      </div>

      {/* Leaving Soon Alert */}
      {leavingSoon.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-amber-600" />
            <p className="text-sm font-medium text-amber-800">
              {leavingSoon.length === 1
                ? "1 employee leaving within 7 days"
                : `${leavingSoon.length} employees leaving within 7 days`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {leavingSoon.map((f) => {
              const lwd = toDate(f.lastWorkingDay);
              const diff = lwd ? differenceInDays(lwd, now) : null;
              return (
                <Link
                  key={f.id}
                  to={`/offboardings/${f.id}`}
                  className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-full px-3 py-1 text-xs text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  <span className="font-medium">{f.employeeName}</span>
                  <span className="text-amber-600">
                    {diff === 0 ? "· today" : diff === 1 ? "· tomorrow" : `· ${diff}d`}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Active Offboardings */}
        <div className="lg:col-span-3">
          <Card padding="none">
            <div className="flex items-center justify-between px-6 py-4 border-b border-navy/5">
              <h2 className="text-base font-semibold text-navy">
                Active Offboardings
              </h2>
              {sortedActiveFlows.length > 0 && (
                <Link
                  to="/offboardings"
                  className="text-sm text-teal hover:text-teal-light flex items-center gap-1"
                >
                  View all <ArrowRight size={14} />
                </Link>
              )}
            </div>

            {flowsLoading ? (
              <div className="py-12 text-center text-sm text-mist">Loading...</div>
            ) : sortedActiveFlows.length === 0 ? (
              <EmptyState
                title="No active offboardings"
                description="Ready when you need it. Start your first offboarding process."
                action={
                  <Link to="/offboardings/new">
                    <Button>
                      <Plus size={16} className="mr-1.5" />
                      Start Offboarding
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-navy/5">
                {sortedActiveFlows.slice(0, 8).map((flow) => {
                  const lwd = toDate(flow.lastWorkingDay);
                  const remaining = lwd ? daysRemaining(lwd) : null;
                  return (
                    <Link
                      key={flow.id}
                      to={`/offboardings/${flow.id}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-navy/[0.02] transition-colors"
                    >
                      <div className="h-10 w-10 rounded-full bg-teal/10 flex items-center justify-center text-teal font-medium text-sm flex-shrink-0">
                        {flow.employeeName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-navy truncate">
                            {flow.employeeName}
                          </p>
                          {remaining && (
                            <span
                              className={clsx(
                                "text-xs px-1.5 py-0.5 rounded-full flex-shrink-0",
                                remaining.urgent
                                  ? "bg-ember/10 text-ember"
                                  : "bg-navy/5 text-mist"
                              )}
                            >
                              {remaining.label}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-mist">
                          {flow.employeeRole} · {flow.employeeDepartment}
                        </p>
                      </div>
                      <div className="hidden sm:block w-24">
                        <Progress value={flow.progressPercent} size="sm" />
                        <p className="text-xs text-mist mt-1 text-right">
                          {flow.progressPercent}%
                        </p>
                      </div>
                      <Badge
                        variant={flow.status === "in_progress" ? "teal" : "mist"}
                      >
                        {flow.status === "in_progress" ? "In Progress" : "Not Started"}
                      </Badge>
                    </Link>
                  );
                })}
                {sortedActiveFlows.length > 8 && (
                  <div className="px-6 py-3 text-center">
                    <Link
                      to="/offboardings"
                      className="text-sm text-teal hover:text-teal-light"
                    >
                      +{sortedActiveFlows.length - 8} more offboardings
                    </Link>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <div className="px-6 py-4 border-b border-navy/5">
              <h2 className="text-base font-semibold text-navy">Recent Activity</h2>
            </div>

            {flowsLoading ? (
              <div className="py-12 text-center text-sm text-mist">Loading...</div>
            ) : activities.length === 0 ? (
              <EmptyState
                title="No recent activity"
                description="Activity will appear here as offboardings progress."
              />
            ) : (
              <div className="divide-y divide-navy/5">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 px-6 py-3"
                  >
                    <div
                      className={clsx(
                        "mt-0.5 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                        activity.icon === "check" && "bg-teal/10 text-teal",
                        activity.icon === "user" && "bg-navy/10 text-navy",
                        activity.icon === "book" && "bg-blue-50 text-blue-600"
                      )}
                    >
                      {activity.icon === "check" && <CheckCircle size={14} />}
                      {activity.icon === "user" && <Users size={14} />}
                      {activity.icon === "book" && <BookOpen size={14} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy">
                        {activity.title}
                      </p>
                      <p className="text-xs text-mist truncate">
                        {activity.subtitle}
                      </p>
                    </div>

                    <span className="text-xs text-mist flex-shrink-0">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
