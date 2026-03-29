import { useState, useEffect } from "react";
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
} from "lucide-react";
import { format, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import clsx from "clsx";
import { where, orderBy, limit as firestoreLimit, Timestamp } from "firebase/firestore";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Progress } from "../../components/ui/Progress";
import { EmptyState } from "../../components/shared/EmptyState";
import { useAuth } from "../../hooks/useAuth";
import { queryDocuments } from "../../lib/firestore";
import type { OffboardFlow, FlowTask } from "../../types/offboarding.types";

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  highlight?: boolean;
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

function StatCard({ label, value, icon, color, highlight }: StatCardProps) {
  return (
    <Card>
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
}

export default function Dashboard() {
  const { appUser, companyId } = useAuth();
  const [flows, setFlows] = useState<OffboardFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [overdueTasks, setOverdueTasks] = useState(0);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  useEffect(() => {
    if (!companyId) return;
    const loadDashboardData = async () => {
      try {
        // Load flows
        const results = await queryDocuments<OffboardFlow>("offboardFlows", [
          where("companyId", "==", companyId),
          orderBy("createdAt", "desc"),
          firestoreLimit(10),
        ]);
        setFlows(results);

        const activeFlowIds = results
          .filter((f) => f.status === "in_progress" || f.status === "not_started")
          .map((f) => f.id);

        // Load knowledge items
        const knowledgeItems = await queryDocuments<KnowledgeItemBrief>("knowledgeItems", [
          where("companyId", "==", companyId),
        ]);
        setKnowledgeCount(knowledgeItems.length);

        // Load tasks for active flows
        let allTasks: FlowTask[] = [];
        let recentTasks: FlowTask[] = [];

        if (activeFlowIds.length > 0) {
          const batchIds = activeFlowIds.slice(0, 30);

          // Overdue tasks: pending/in_progress tasks
          const pendingTasks = await queryDocuments<FlowTask>("flowTasks", [
            where("flowId", "in", batchIds),
            where("status", "in", ["pending", "in_progress"]),
          ]);
          allTasks = pendingTasks;

          const now = new Date();
          const overdueCount = pendingTasks.filter((task) => {
            const dueDate = toDate(task.dueDate);
            return dueDate && dueDate < now;
          }).length;
          setOverdueTasks(overdueCount);

          // Completed tasks for activity feed
          recentTasks = await queryDocuments<FlowTask>("flowTasks", [
            where("flowId", "in", batchIds),
            where("status", "==", "completed"),
          ]);
        } else {
          setOverdueTasks(0);
        }

        // Build activity feed
        const activityItems: ActivityItem[] = [];

        // From flows (recently started)
        results.slice(0, 5).forEach((flow) => {
          const createdAt = toDate(flow.createdAt);
          if (createdAt) {
            activityItems.push({
              id: `flow-${flow.id}`,
              type: "offboarding_started",
              title: "Offboarding started",
              subtitle: `${flow.employeeName} · ${flow.employeeRole}`,
              timestamp: createdAt,
              icon: "user",
            });
          }
        });

        // From completed tasks (most recent 10)
        recentTasks
          .filter((t) => t.completedAt)
          .sort((a, b) => {
            const aDate = toDate(a.completedAt);
            const bDate = toDate(b.completedAt);
            return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
          })
          .slice(0, 10)
          .forEach((task) => {
            const completedAt = toDate(task.completedAt);
            if (completedAt) {
              activityItems.push({
                id: `task-${task.id}`,
                type: "task_completed",
                title: "Task completed",
                subtitle: task.title,
                timestamp: completedAt,
                icon: "check",
              });
            }
          });

        // From knowledge items
        knowledgeItems.slice(0, 5).forEach((item) => {
          const createdAt = toDate(item.createdAt);
          if (createdAt) {
            activityItems.push({
              id: `knowledge-${item.id}`,
              type: "knowledge_submitted",
              title: "Knowledge item added",
              subtitle: item.title || "Untitled",
              timestamp: createdAt,
              icon: "book",
            });
          }
        });

        // Sort by timestamp descending, take top 8
        activityItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setActivities(activityItems.slice(0, 8));

        // Suppress unused variable warning
        void allTasks;
      } catch {
        // Partial data is fine — individual counters stay at their defaults
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, [companyId]);

  const activeFlows = flows.filter(
    (f) => f.status === "in_progress" || f.status === "not_started"
  );

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const completingThisWeek = activeFlows.filter((f) => {
    const lwd = toDate(f.lastWorkingDay);
    return lwd && isWithinInterval(lwd, { start: weekStart, end: weekEnd });
  }).length;

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
        />
        <StatCard
          label="Completing This Week"
          value={completingThisWeek}
          icon={<CalendarClock size={20} className="text-amber-600" />}
          color="bg-amber-100"
        />
        <StatCard
          label="Knowledge Items"
          value={knowledgeCount}
          icon={<BookOpen size={20} className="text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          label="Overdue Tasks"
          value={overdueTasks}
          icon={<AlertTriangle size={20} className="text-ember" />}
          color="bg-ember/10"
          highlight
        />
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Active Offboardings */}
        <div className="lg:col-span-3">
          <Card padding="none">
            <div className="flex items-center justify-between px-6 py-4 border-b border-navy/5">
              <h2 className="text-base font-semibold text-navy">
                Active Offboardings
              </h2>
              {activeFlows.length > 0 && (
                <Link
                  to="/offboardings"
                  className="text-sm text-teal hover:text-teal-light flex items-center gap-1"
                >
                  View all <ArrowRight size={14} />
                </Link>
              )}
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-mist">
                Loading...
              </div>
            ) : activeFlows.length === 0 ? (
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
                {activeFlows.map((flow) => (
                  <Link
                    key={flow.id}
                    to={`/offboardings/${flow.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-navy/[0.02] transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-teal/10 flex items-center justify-center text-teal font-medium text-sm flex-shrink-0">
                      {flow.employeeName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy">
                        {flow.employeeName}
                      </p>
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
                      variant={
                        flow.status === "in_progress" ? "teal" : "mist"
                      }
                    >
                      {flow.status === "in_progress"
                        ? "In Progress"
                        : "Not Started"}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <div className="px-6 py-4 border-b border-navy/5">
              <h2 className="text-base font-semibold text-navy">
                Recent Activity
              </h2>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-mist">Loading...</div>
            ) : activities.length === 0 ? (
              <EmptyState
                title="No recent activity"
                description="Activity will appear here as offboardings progress."
              />
            ) : (
              <div className="divide-y divide-navy/5">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 px-6 py-3">
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
