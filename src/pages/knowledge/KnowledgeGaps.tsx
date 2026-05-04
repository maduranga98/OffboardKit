import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Search,
  CheckCircle,
  UserPlus,
  RefreshCw,
  Calendar,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, subMonths } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import clsx from "clsx";
import { functions } from "../../lib/firebase";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeToCollection,
  queryDocuments,
  updateDocument,
  serverTimestamp,
  where,
  orderBy,
} from "../../lib/firestore";
import type {
  KnowledgeItem,
  GapSeverity,
  GapStatus,
} from "../../types/knowledge.types";
import type { AppUser } from "../../types/user.types";

const GAP_SEVERITY_CLASSES: Record<GapSeverity, string> = {
  critical: "bg-ember/10 text-ember",
  high: "bg-orange-50 text-orange-600",
  medium: "bg-amber-50 text-amber-600",
  low: "bg-blue-50 text-blue-600",
};

const SEVERITY_ORDER: Record<GapSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PAGE_SIZE = 20;

type GapStatusFilter = "open" | "all" | "resolved";
type SortField = "severity" | "createdAt";
type SortDir = "asc" | "desc";

// ─── Resolve Modal ─────────────────────────────────────────────────────────────

interface ResolveModalProps {
  item: KnowledgeItem;
  onClose: () => void;
  onConfirm: (id: string, note: string) => Promise<void>;
}

function ResolveModal({ item, onClose, onConfirm }: ResolveModalProps) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      await onConfirm(item.id, note.trim());
      onClose();
    } catch {
      // Error already shown by parent
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen title="Mark Gap as Resolved" onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="bg-navy/[0.03] rounded-lg p-3">
          <p className="text-sm font-medium text-navy">{item.title}</p>
          <p className="text-xs text-mist mt-0.5">
            {item.employeeName} · {item.employeeDepartment}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-navy mb-1">
            Resolution notes{" "}
            <span className="font-normal text-mist">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Describe how this gap was resolved..."
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={saving}>
          <CheckCircle size={14} className="mr-1.5" />
          Mark Resolved
        </Button>
      </div>
    </Modal>
  );
}

// ─── Assign Modal ──────────────────────────────────────────────────────────────

interface AssignModalProps {
  item: KnowledgeItem;
  users: Record<string, string>;
  onClose: () => void;
  onConfirm: (id: string, assignedTo: string, dueDate: string) => Promise<void>;
}

function AssignModal({ item, users, onClose, onConfirm }: AssignModalProps) {
  const [assignedTo, setAssignedTo] = useState(item.gapAssignedTo || "");
  const [dueDate, setDueDate] = useState(
    item.gapDueDate?.toDate ? format(item.gapDueDate.toDate(), "yyyy-MM-dd") : ""
  );
  const [saving, setSaving] = useState(false);

  const userOptions = Object.entries(users).filter(([, name]) => Boolean(name));

  async function handleSubmit() {
    if (!assignedTo) return;
    setSaving(true);
    try {
      await onConfirm(item.id, assignedTo, dueDate);
      onClose();
    } catch {
      // Error already shown by parent
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      title={item.gapAssignedTo ? "Reassign Gap" : "Assign Gap"}
      onClose={onClose}
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-navy/[0.03] rounded-lg p-3">
          <p className="text-sm font-medium text-navy">{item.title}</p>
          <p className="text-xs text-mist mt-0.5">
            {item.employeeName} · {item.employeeDepartment}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-navy mb-1">
            Assign to
          </label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
          >
            <option value="">Select team member...</option>
            {userOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-navy mb-1">
            Due date{" "}
            <span className="font-normal text-mist">(optional)</span>
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={saving} disabled={!assignedTo}>
          <UserPlus size={14} className="mr-1.5" />
          {item.gapAssignedTo ? "Reassign" : "Assign"}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Gap Row ───────────────────────────────────────────────────────────────────

interface GapRowProps {
  item: KnowledgeItem;
  users: Record<string, string>;
  isExpanded: boolean;
  onToggle: () => void;
  onResolve: (item: KnowledgeItem) => void;
  onAssign: (item: KnowledgeItem) => void;
  onReanalyze: (item: KnowledgeItem) => void;
  reanalyzingIds: Set<string>;
}

function GapRow({
  item,
  users,
  isExpanded,
  onToggle,
  onResolve,
  onAssign,
  onReanalyze,
  reanalyzingIds,
}: GapRowProps) {
  const severity = item.gapSeverity ?? "low";
  const isResolved = item.gapStatus === "resolved";
  const assignedName = item.gapAssignedTo
    ? users[item.gapAssignedTo] || item.gapAssignedTo
    : null;
  const resolvedByName = item.gapResolvedBy
    ? users[item.gapResolvedBy] || item.gapResolvedBy
    : null;
  const dueDateValue = item.gapDueDate?.toDate?.();
  const isOverdue = !isResolved && !!dueDateValue && dueDateValue < new Date();

  return (
    <div>
      <div
        className={clsx(
          "flex items-start gap-3 px-6 py-4 cursor-pointer hover:bg-navy/[0.02]",
          isResolved && "opacity-60"
        )}
        onClick={onToggle}
      >
        <AlertCircle
          size={16}
          className={clsx(
            "flex-shrink-0 mt-0.5",
            isResolved
              ? "text-teal"
              : severity === "critical"
                ? "text-ember"
                : severity === "high"
                  ? "text-orange-600"
                  : severity === "medium"
                    ? "text-amber-600"
                    : "text-blue-600"
          )}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-navy">{item.title}</p>
            {isResolved ? (
              <Badge variant="teal">
                <CheckCircle size={11} className="mr-0.5" />
                Resolved
              </Badge>
            ) : (
              <Badge className={GAP_SEVERITY_CLASSES[severity]}>{severity}</Badge>
            )}
            {assignedName && !isResolved && (
              <Badge variant="mist">→ {assignedName}</Badge>
            )}
            {isOverdue && <Badge variant="ember">Overdue</Badge>}
          </div>
          <p className="text-xs text-mist mt-1">
            {item.employeeName}
            {item.employeeDepartment ? ` · ${item.employeeDepartment}` : ""}
          </p>
          {dueDateValue && !isResolved && (
            <p
              className={clsx(
                "text-xs mt-0.5 flex items-center gap-1",
                isOverdue ? "text-ember" : "text-mist"
              )}
            >
              <Calendar size={11} />
              Due {format(dueDateValue, "MMM d, yyyy")}
            </p>
          )}
        </div>

        {!isResolved && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onResolve(item);
              }}
            >
              <CheckCircle size={13} className="mr-1" />
              Resolve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onAssign(item);
              }}
            >
              <UserPlus size={13} className="mr-1" />
              {item.gapAssignedTo ? "Reassign" : "Assign"}
            </Button>
          </div>
        )}
      </div>

      {/* Expansion panel */}
      {isExpanded && (
        <div className="bg-navy/[0.02] px-6 py-4 border-t border-navy/5 space-y-3">
          {item.gapReason && (
            <div>
              <p className="text-xs font-medium text-mist mb-1">Gap Reason</p>
              <p className="text-sm text-navy bg-white rounded-lg p-3 border border-navy/5">
                {item.gapReason}
              </p>
            </div>
          )}

          {item.description && (
            <div>
              <p className="text-xs font-medium text-mist mb-1">Item Description</p>
              <p className="text-sm text-navy bg-white rounded-lg p-3 border border-navy/5 line-clamp-3">
                {item.description}
              </p>
            </div>
          )}

          {assignedName && !isResolved && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
              <UserPlus size={13} className="text-blue-600 flex-shrink-0" />
              <span className="text-blue-900">
                Assigned to <strong>{assignedName}</strong>
                {dueDateValue
                  ? ` · Due ${format(dueDateValue, "MMM d, yyyy")}`
                  : ""}
              </span>
            </div>
          )}

          {isResolved && (
            <div className="bg-teal/10 border border-teal/30 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 text-xs text-teal">
                <CheckCircle size={13} className="flex-shrink-0" />
                <span>
                  Resolved by <strong>{resolvedByName || "—"}</strong>
                  {item.gapResolvedAt?.toDate
                    ? ` on ${format(item.gapResolvedAt.toDate(), "MMM d, yyyy")}`
                    : ""}
                </span>
              </div>
              {item.gapResolutionNote && (
                <p className="text-xs text-teal/80 pl-5">{item.gapResolutionNote}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1 flex-wrap">
            {item.flowId && (
              <Link
                to={`/offboardings/${item.flowId}`}
                className="text-xs text-teal hover:underline"
              >
                View offboarding →
              </Link>
            )}
            {!isResolved && item.flowId && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onReanalyze(item)}
                loading={reanalyzingIds.has(item.id)}
                disabled={reanalyzingIds.has(item.id)}
              >
                <RefreshCw size={12} className="mr-1" />
                Re-analyze flow
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function KnowledgeGaps() {
  const { companyId, appUser } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<GapSeverity | "all">("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<GapStatusFilter>("open");
  const [sortField, setSortField] = useState<SortField>("severity");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [resolvingItem, setResolvingItem] = useState<KnowledgeItem | null>(null);
  const [assigningItem, setAssigningItem] = useState<KnowledgeItem | null>(null);
  const [reanalyzingIds, setReanalyzingIds] = useState<Set<string>>(new Set());

  const loadUsers = useCallback(async () => {
    if (!companyId) return;
    try {
      const usersData = await queryDocuments<AppUser>("users", [
        where("companyId", "==", companyId),
      ]);
      const userMap: Record<string, string> = {};
      usersData.forEach((u) => {
        userMap[u.id] = u.displayName || u.email;
      });
      setUsers(userMap);
    } catch {
      showToast("error", "Failed to load team data");
    }
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    loadUsers();
    const unsub = subscribeToCollection<KnowledgeItem>(
      "knowledgeItems",
      [
        where("companyId", "==", companyId),
        where("hasGap", "==", true),
        orderBy("createdAt", "desc"),
      ],
      (data) => {
        setItems(data);
        setLoading(false);
      }
    );
    return unsub;
  }, [companyId, loadUsers]);

  useEffect(() => {
    setPage(0);
  }, [search, severityFilter, departmentFilter, statusFilter, sortField, sortDir]);

  const departments = useMemo(() => {
    const depts = [...new Set(items.map((i) => i.employeeDepartment).filter(Boolean))];
    return depts.sort();
  }, [items]);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const isResolved = item.gapStatus === "resolved";
      if (statusFilter === "open" && isResolved) return false;
      if (statusFilter === "resolved" && !isResolved) return false;
      if (severityFilter !== "all" && item.gapSeverity !== severityFilter) return false;
      if (departmentFilter !== "all" && item.employeeDepartment !== departmentFilter)
        return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          (item.gapReason ?? "").toLowerCase().includes(q) ||
          item.employeeName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, statusFilter, severityFilter, departmentFilter, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "severity") {
        cmp =
          (SEVERITY_ORDER[a.gapSeverity ?? "low"] ?? 3) -
          (SEVERITY_ORDER[b.gapSeverity ?? "low"] ?? 3);
      } else {
        const aMs = a.createdAt?.toDate?.()?.getTime() ?? 0;
        const bMs = b.createdAt?.toDate?.()?.getTime() ?? 0;
        cmp = aMs - bMs;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const stats = useMemo(() => {
    const open = items.filter((i) => i.gapStatus !== "resolved");
    return {
      total: items.length,
      open: open.length,
      resolved: items.length - open.length,
      critical: open.filter((i) => i.gapSeverity === "critical").length,
      high: open.filter((i) => i.gapSeverity === "high").length,
      medium: open.filter((i) => i.gapSeverity === "medium").length,
      low: open.filter((i) => i.gapSeverity === "low").length,
    };
  }, [items]);

  const trendData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      const monthKey = format(d, "MMM yyyy");
      const opened = items.filter((item) => {
        const fd = item.createdAt?.toDate?.();
        return fd && format(fd, "MMM yyyy") === monthKey;
      }).length;
      const resolved = items.filter((item) => {
        if (item.gapStatus !== "resolved") return false;
        const fd = item.gapResolvedAt?.toDate?.();
        return fd && format(fd, "MMM yyyy") === monthKey;
      }).length;
      return { month: format(d, "MMM"), opened, resolved };
    });
  }, [items]);

  const hasTrendData = trendData.some((d) => d.opened > 0 || d.resolved > 0);

  async function handleResolve(id: string, note: string) {
    if (!appUser) return;
    try {
      await updateDocument("knowledgeItems", id, {
        gapStatus: "resolved" as GapStatus,
        gapResolvedBy: appUser.id,
        gapResolvedAt: serverTimestamp(),
        gapResolutionNote: note || null,
        updatedAt: serverTimestamp(),
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                gapStatus: "resolved" as GapStatus,
                gapResolvedBy: appUser.id,
                gapResolutionNote: note || undefined,
                gapResolvedAt: new Date() as unknown as KnowledgeItem["gapResolvedAt"],
              }
            : i
        )
      );
      showToast("success", "Gap marked as resolved");
    } catch {
      showToast("error", "Failed to resolve gap");
      throw new Error("Resolve failed");
    }
  }

  async function handleAssign(id: string, assignedTo: string, dueDate: string) {
    try {
      const dueDateTs = dueDate
        ? Timestamp.fromDate(new Date(dueDate + "T00:00:00"))
        : null;
      await updateDocument("knowledgeItems", id, {
        gapAssignedTo: assignedTo,
        gapDueDate: dueDateTs,
        updatedAt: serverTimestamp(),
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, gapAssignedTo: assignedTo, gapDueDate: dueDateTs }
            : i
        )
      );
      showToast("success", "Gap assigned");
    } catch {
      showToast("error", "Failed to assign gap");
      throw new Error("Assign failed");
    }
  }

  async function handleReanalyze(item: KnowledgeItem) {
    setReanalyzingIds((prev) => new Set(prev).add(item.id));
    try {
      const detectGaps = httpsCallable(functions, "detectKnowledgeGaps");
      await detectGaps({ flowId: item.flowId });
      showToast("success", "Re-analysis complete — refreshing data");
      setLoading(true);
      await loadData();
    } catch {
      showToast("error", "Re-analysis failed. Please try again.");
    } finally {
      setReanalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  function SortButton({ field, label }: { field: SortField; label: string }) {
    return (
      <button
        onClick={() => toggleSort(field)}
        className={clsx(
          "flex items-center gap-1 text-xs font-medium transition-colors",
          sortField === field ? "text-teal" : "text-mist hover:text-navy"
        )}
      >
        {label}
        <ArrowUpDown size={11} />
      </button>
    );
  }

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-display text-navy">Knowledge Gaps</h1>
          {stats.open > 0 && <Badge variant="ember">{stats.open} open</Badge>}
        </div>
        <p className="text-sm text-mist mt-1">
          Identified knowledge gaps in offboarding documentation
        </p>
      </div>

      {/* Stats */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {(
            [
              { label: "Total", value: stats.total, color: "text-navy" },
              { label: "Critical", value: stats.critical, color: stats.critical > 0 ? "text-ember" : "text-navy" },
              { label: "High", value: stats.high, color: stats.high > 0 ? "text-orange-600" : "text-navy" },
              { label: "Medium", value: stats.medium, color: stats.medium > 0 ? "text-amber-600" : "text-navy" },
              { label: "Low", value: stats.low, color: stats.low > 0 ? "text-blue-600" : "text-navy" },
              { label: "Resolved", value: stats.resolved, color: stats.resolved > 0 ? "text-teal" : "text-navy" },
            ] as const
          ).map(({ label, value, color }) => (
            <Card key={label}>
              <div className="space-y-1">
                <p className="text-xs font-medium text-mist">{label}</p>
                <p className={clsx("text-2xl font-semibold", color)}>{value}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Trend chart */}
      {hasTrendData && (
        <Card>
          <h2 className="text-base font-semibold text-navy mb-4">
            Gap Trend (last 6 months)
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trendData} barGap={2}>
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
              <Legend />
              <Bar dataKey="opened" name="Opened" fill="#FF6B47" radius={[3, 3, 0, 0]} />
              <Bar dataKey="resolved" name="Resolved" fill="#0D9E8A" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Filter bar */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-mist"
          />
          <input
            type="text"
            placeholder="Search by title, reason, or employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
          {/* Status toggle */}
          <div className="flex items-center border border-navy/10 rounded-lg overflow-hidden self-start">
            {(["open", "all", "resolved"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  "px-3 py-2 text-sm capitalize transition-colors",
                  statusFilter === s
                    ? "bg-teal text-white"
                    : "text-mist hover:text-navy hover:bg-navy/5"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as GapSeverity | "all")}
            className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
          >
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-mist">Sort:</span>
          <SortButton field="severity" label="Severity" />
          <SortButton field="createdAt" label="Date" />
        </div>
      </div>

      {/* Result count */}
      {filtered.length > 0 && (
        <p className="text-xs text-mist">
          {filtered.length} gap{filtered.length !== 1 ? "s" : ""}
          {filtered.length !== items.length
            ? ` (filtered from ${items.length})`
            : ""}
        </p>
      )}

      {/* Content */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title={
              items.length === 0
                ? "No knowledge gaps identified"
                : statusFilter === "resolved"
                  ? "No resolved gaps yet"
                  : "No matching gaps"
            }
            description={
              items.length === 0
                ? "Once gaps are detected, they will appear here."
                : "Try adjusting your filters."
            }
          />
        </Card>
      ) : (
        <>
          <Card padding="none">
            <div className="divide-y divide-navy/5">
              {paginated.map((item) => (
                <GapRow
                  key={item.id}
                  item={item}
                  users={users}
                  isExpanded={expandedIds.has(item.id)}
                  onToggle={() => toggleExpanded(item.id)}
                  onResolve={setResolvingItem}
                  onAssign={setAssigningItem}
                  onReanalyze={handleReanalyze}
                  reanalyzingIds={reanalyzingIds}
                />
              ))}
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-mist">
                Page {page + 1} of {totalPages} &middot; {sorted.length} total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft size={14} className="mr-1" />
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  Next
                  <ChevronRight size={14} className="ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Resolve Modal */}
      {resolvingItem && (
        <ResolveModal
          item={resolvingItem}
          onClose={() => setResolvingItem(null)}
          onConfirm={handleResolve}
        />
      )}

      {/* Assign Modal */}
      {assigningItem && (
        <AssignModal
          item={assigningItem}
          users={users}
          onClose={() => setAssigningItem(null)}
          onConfirm={handleAssign}
        />
      )}
    </div>
  );
}
