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
} from "lucide-react";
import { format } from "date-fns";
import clsx from "clsx";
import { where, orderBy, limit as firestoreLimit } from "firebase/firestore";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Progress } from "../../components/ui/Progress";
import { EmptyState } from "../../components/shared/EmptyState";
import { useAuth } from "../../hooks/useAuth";
import { queryDocuments } from "../../lib/firestore";
import type { OffboardFlow } from "../../types/offboarding.types";

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  highlight?: boolean;
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

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  useEffect(() => {
    if (!companyId) return;
    const loadFlows = async () => {
      try {
        const results = await queryDocuments<OffboardFlow>("offboardFlows", [
          where("companyId", "==", companyId),
          orderBy("createdAt", "desc"),
          firestoreLimit(10),
        ]);
        setFlows(results);
      } catch {
        // No flows yet
      } finally {
        setLoading(false);
      }
    };
    loadFlows();
  }, [companyId]);

  const activeFlows = flows.filter(
    (f) => f.status === "in_progress" || f.status === "not_started"
  );
  const overdueTasks = 0;

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
          value={0}
          icon={<CalendarClock size={20} className="text-amber-600" />}
          color="bg-amber-100"
        />
        <StatCard
          label="Knowledge Items"
          value={0}
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
            <EmptyState
              title="No recent activity"
              description="Activity will appear here as offboardings progress."
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
