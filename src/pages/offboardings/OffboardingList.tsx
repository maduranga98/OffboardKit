import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Plus,
  Search,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { format, differenceInDays, isPast } from "date-fns";
import { where, orderBy } from "firebase/firestore";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Progress } from "../../components/ui/Progress";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { useAuth } from "../../hooks/useAuth";
import { queryDocuments } from "../../lib/firestore";
import type { OffboardFlow, FlowStatus } from "../../types/offboarding.types";

type FilterTab = "all" | "active" | "completed" | "cancelled";

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

function statusBadge(status: FlowStatus) {
  const map: Record<FlowStatus, { label: string; variant: "teal" | "mist" | "ember" }> = {
    not_started: { label: "Not Started", variant: "mist" },
    in_progress: { label: "In Progress", variant: "teal" },
    completed: { label: "Completed", variant: "teal" },
    cancelled: { label: "Cancelled", variant: "ember" },
  };
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function daysChip(lastWorkingDay: Timestamp) {
  const lwdDate = toDate(lastWorkingDay);
  if (!lwdDate) return null;
  const days = differenceInDays(lwdDate, new Date());
  if (days < 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-ember/10 text-ember">
        {Math.abs(days)}d overdue
      </span>
    );
  }
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium",
        days <= 7
          ? "bg-amber-100 text-amber-700"
          : "bg-teal/10 text-teal"
      )}
    >
      {days}d left
    </span>
  );
}

export default function OffboardingList() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const [flows, setFlows] = useState<OffboardFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      try {
        const results = await queryDocuments<OffboardFlow>("offboardFlows", [
          where("companyId", "==", companyId),
          orderBy("createdAt", "desc"),
        ]);
        setFlows(results);
      } catch {
        // No flows yet
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

  // Stats
  const totalCount = flows.length;
  const activeCount = flows.filter(
    (f) => f.status === "not_started" || f.status === "in_progress"
  ).length;
  const completedCount = flows.filter((f) => f.status === "completed").length;
  const overdueCount = flows.filter((f) => {
    if (f.status !== "in_progress" && f.status !== "not_started") return false;
    const lwdDate = toDate(f.lastWorkingDay);
    return lwdDate ? isPast(lwdDate) : false;
  }).length;

  // Filter
  const tabFiltered = flows.filter((f) => {
    if (activeTab === "active")
      return f.status === "not_started" || f.status === "in_progress";
    if (activeTab === "completed") return f.status === "completed";
    if (activeTab === "cancelled") return f.status === "cancelled";
    return true;
  });

  const filtered = tabFiltered.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.employeeName.toLowerCase().includes(q) ||
      f.employeeDepartment.toLowerCase().includes(q)
    );
  });

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display text-navy">Offboardings</h1>
          <p className="text-sm text-mist mt-1">
            Track and manage employee offboarding processes
          </p>
        </div>
        <Link to="/offboardings/new">
          <Button>
            <Plus size={16} className="mr-1.5" />
            New Offboarding
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-mist">Total</p>
              <p className="text-3xl font-semibold text-navy mt-1">
                {totalCount}
              </p>
            </div>
            <div className="p-2 rounded-md bg-navy/5">
              <Users size={20} className="text-navy" />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-mist">Active</p>
              <p className="text-3xl font-semibold text-navy mt-1">
                {activeCount}
              </p>
            </div>
            <div className="p-2 rounded-md bg-teal/10">
              <Clock size={20} className="text-teal" />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-mist">Completed</p>
              <p className="text-3xl font-semibold text-navy mt-1">
                {completedCount}
              </p>
            </div>
            <div className="p-2 rounded-md bg-teal/10">
              <CheckCircle size={20} className="text-teal" />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-mist">Overdue</p>
              <p
                className={clsx(
                  "text-3xl font-semibold mt-1",
                  overdueCount > 0 ? "text-ember" : "text-navy"
                )}
              >
                {overdueCount}
              </p>
            </div>
            <div className="p-2 rounded-md bg-ember/10">
              <AlertTriangle size={20} className="text-ember" />
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex gap-1 bg-navy/5 rounded-md p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                activeTab === tab.key
                  ? "bg-white text-navy shadow-sm"
                  : "text-mist hover:text-navy"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1 max-w-xs">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-mist"
            />
            <input
              type="text"
              placeholder="Search by name or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-md border border-navy/20 pl-9 pr-3 py-2 text-sm text-navy placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
            />
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={48} strokeWidth={1.5} />}
            title={
              search
                ? "No matching offboardings"
                : activeTab !== "all"
                  ? `No ${activeTab} offboardings`
                  : "No offboardings yet"
            }
            description={
              search
                ? "Try adjusting your search terms."
                : "Start your first offboarding process to see it here."
            }
            action={
              !search && activeTab === "all" ? (
                <Link to="/offboardings/new">
                  <Button>
                    <Plus size={16} className="mr-1.5" />
                    New Offboarding
                  </Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-navy/5">
            {filtered.map((flow) => {
              const lwdDate = toDate(flow.lastWorkingDay);
              const isOverdue = lwdDate ? isPast(lwdDate) : false;

              return (
                <button
                  key={flow.id}
                  onClick={() => navigate(`/offboardings/${flow.id}`)}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-navy/[0.02] transition-colors w-full text-left"
                >
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-teal/10 flex items-center justify-center text-teal font-medium text-sm flex-shrink-0">
                    {flow.employeeName.charAt(0)}
                  </div>

                  {/* Name + role */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy truncate">
                      {flow.employeeName}
                    </p>
                    <p className="text-xs text-mist mt-0.5 truncate">
                      {flow.employeeRole} · {flow.employeeDepartment}
                    </p>
                  </div>

                  {/* Last working day */}
                  <div className="hidden md:block text-right flex-shrink-0">
                    <p
                      className={clsx(
                        "text-xs",
                        isOverdue && flow.status !== "completed" && flow.status !== "cancelled"
                          ? "text-ember font-medium"
                          : "text-mist"
                      )}
                    >
                      {lwdDate ? format(lwdDate, "MMM d, yyyy") : "—"}
                    </p>
                  </div>

                  {/* Progress */}
                  <div className="hidden sm:block w-24 flex-shrink-0">
                    <Progress value={flow.progressPercent} size="sm" />
                    <p className="text-xs text-mist mt-1 text-right">
                      {flow.progressPercent}%
                    </p>
                  </div>

                  {/* Status */}
                  <div className="hidden sm:block flex-shrink-0">
                    {statusBadge(flow.status)}
                  </div>

                  {/* Days chip */}
                  <div className="hidden lg:block flex-shrink-0">
                    {flow.status !== "completed" && flow.status !== "cancelled" && flow.lastWorkingDay
                      ? daysChip(flow.lastWorkingDay)
                      : null}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
