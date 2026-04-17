import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Plus,
  Search,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  Trash2,
  X,
  Check,
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
import { queryDocuments, updateDocument, deleteDocument } from "../../lib/firestore";
import { showToast } from "../../components/ui/Toast";
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
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((f) => f.id)));
    }
  };

  const handleBulkComplete = async () => {
    if (selected.size === 0) return;
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          updateDocument("offboardFlows", id, { status: "completed" })
        )
      );
      setFlows((prev) =>
        prev.map((f) =>
          selected.has(f.id) ? { ...f, status: "completed" as const } : f
        )
      );
      setSelected(new Set());
      showToast("success", `Completed ${selected.size} offboarding(s)`);
    } catch {
      showToast("error", "Failed to complete offboardings");
    }
  };

  const handleBulkCancel = async () => {
    if (selected.size === 0) return;
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          updateDocument("offboardFlows", id, { status: "cancelled" })
        )
      );
      setFlows((prev) =>
        prev.map((f) =>
          selected.has(f.id) ? { ...f, status: "cancelled" as const } : f
        )
      );
      setSelected(new Set());
      showToast("success", `Cancelled ${selected.size} offboarding(s)`);
    } catch {
      showToast("error", "Failed to cancel offboardings");
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} offboarding(s)? This cannot be undone.`)) return;
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          deleteDocument("offboardFlows", id)
        )
      );
      setFlows((prev) => prev.filter((f) => !selected.has(f.id)));
      setSelected(new Set());
      showToast("success", `Deleted ${selected.size} offboarding(s)`);
    } catch {
      showToast("error", "Failed to delete offboardings");
    }
  };

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
        <>
          {selected.size > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-navy/10 shadow-lg">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                <p className="text-sm font-medium text-navy">
                  {selected.size} selected
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkComplete}
                  >
                    <Check size={14} className="mr-1" />
                    Mark Completed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkCancel}
                  >
                    <X size={14} className="mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkDelete}
                    className="text-ember"
                  >
                    <Trash2 size={14} className="mr-1" />
                    Delete
                  </Button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="ml-2 p-1 text-mist hover:text-navy"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
          <Card padding="none">
            <div className="divide-y divide-navy/5">
              {filtered.length > 0 && (
                <div className="flex items-center gap-4 px-6 py-3 bg-navy/[0.02] border-b border-navy/5">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length}
                    onChange={toggleSelectAll}
                    className="rounded border-navy/20 text-teal focus:ring-teal/50 cursor-pointer"
                  />
                  <span className="text-xs text-mist font-medium">
                    {selected.size === filtered.length ? "Deselect all" : "Select all"}
                  </span>
                </div>
              )}
              {filtered.map((flow) => {
                const lwdDate = toDate(flow.lastWorkingDay);
                const isOverdue = lwdDate ? isPast(lwdDate) : false;
                const isSelected = selected.has(flow.id);

                return (
                  <div
                    key={flow.id}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-navy/[0.02] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(flow.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-navy/20 text-teal focus:ring-teal/50 cursor-pointer"
                    />
                    <button
                      onClick={() => navigate(`/offboardings/${flow.id}`)}
                      className="flex items-center gap-4 flex-1 text-left"
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
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
