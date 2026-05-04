import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  User,
  FileText,
  Key,
  Video,
  StickyNote,
  ExternalLink,
  CheckCircle,
  Search,
  Users,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  History,
  Edit2,
  Trash2,
  Download,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import {
  queryDocuments,
  updateDocument,
  deleteDocument,
  serverTimestamp,
  where,
  orderBy,
} from "../../lib/firestore";
import type {
  KnowledgeItem,
  KnowledgeItemType,
  KnowledgeItemStatus,
  GapSeverity,
  VerificationStatus,
} from "../../types/knowledge.types";
import type { AppUser } from "../../types/user.types";

const TYPE_LABELS: Record<KnowledgeItemType, string> = {
  process: "Process",
  contact: "Contact",
  document: "Document",
  credential_handover: "Credential Handover",
  video_link: "Video Link",
  note: "Note",
};

const TYPE_COLORS: Record<KnowledgeItemType, string> = {
  process: "bg-teal/10 text-teal",
  contact: "bg-blue-50 text-blue-600",
  document: "bg-navy/5 text-navy",
  credential_handover: "bg-ember/10 text-ember",
  video_link: "bg-purple-50 text-purple-600",
  note: "bg-amber-50 text-amber-600",
};

const TYPE_ICONS: Record<KnowledgeItemType, React.ReactNode> = {
  process: <BookOpen size={14} />,
  contact: <User size={14} />,
  document: <FileText size={14} />,
  credential_handover: <Key size={14} />,
  video_link: <Video size={14} />,
  note: <StickyNote size={14} />,
};

const GAP_SEVERITY_CLASSES: Record<GapSeverity, string> = {
  critical: "bg-ember/10 text-ember",
  high: "bg-orange-50 text-orange-600",
  medium: "bg-amber-50 text-amber-600",
  low: "bg-blue-50 text-blue-600",
};

const PAGE_SIZE = 20;

type SortField = "createdAt" | "title" | "type" | "status";
type SortDir = "asc" | "desc";
type VerificationFilter = "all" | "pending" | "verified" | "rejected";

function exportToCsv(items: KnowledgeItem[]) {
  const headers = [
    "Title", "Type", "Status", "Employee", "Department", "Successor",
    "Has Gap", "Gap Severity", "Gap Reason", "Verified", "URL", "Created",
  ];
  const rows = items.map((item) => [
    item.title,
    TYPE_LABELS[item.type],
    item.status,
    item.employeeName,
    item.employeeDepartment || "",
    item.successor || "",
    item.hasGap ? "Yes" : "No",
    item.gapSeverity || "",
    item.gapReason || "",
    item.managerVerified ? "Yes" : "No",
    item.url || "",
    item.createdAt?.toDate ? format(item.createdAt.toDate(), "yyyy-MM-dd") : "",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `knowledge-base-${format(new Date(), "yyyy-MM-dd")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditItemModalProps {
  item: KnowledgeItem;
  onClose: () => void;
  onSave: (
    id: string,
    updates: Partial<Pick<KnowledgeItem, "title" | "type" | "description" | "url" | "successor">>
  ) => Promise<void>;
}

function EditItemModal({ item, onClose, onSave }: EditItemModalProps) {
  const [title, setTitle] = useState(item.title);
  const [type, setType] = useState<KnowledgeItemType>(item.type);
  const [description, setDescription] = useState(item.description || "");
  const [url, setUrl] = useState(item.url || "");
  const [successor, setSuccessor] = useState(item.successor || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave(item.id, {
        title: title.trim(),
        type,
        description: description.trim(),
        url: url.trim(),
        successor: successor.trim(),
      });
      onClose();
    } catch {
      // Error already shown by parent
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen title="Edit Knowledge Item" onClose={onClose} size="lg">
      <div className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Monthly billing reconciliation process"
        />
        <div>
          <label className="block text-sm font-medium text-navy mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as KnowledgeItemType)}
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
          >
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-navy mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe this knowledge item in detail..."
            className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none"
          />
        </div>
        <Input
          label="URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://... optional"
        />
        <Input
          label="Successor / Handover to"
          value={successor}
          onChange={(e) => setSuccessor(e.target.value)}
          placeholder="Who receives this?"
        />
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={saving} disabled={!title.trim()}>
          Save Changes
        </Button>
      </div>
    </Modal>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  item: KnowledgeItem;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading: boolean;
}

function DeleteConfirmModal({ item, onClose, onConfirm, loading }: DeleteConfirmModalProps) {
  return (
    <Modal isOpen title="Delete Knowledge Item" onClose={onClose} size="sm">
      <p className="text-sm text-navy">
        Are you sure you want to delete{" "}
        <strong>&ldquo;{item.title}&rdquo;</strong>? This cannot be undone.
      </p>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          Delete
        </Button>
      </div>
    </Modal>
  );
}

// ─── Knowledge Item Row ───────────────────────────────────────────────────────

interface KnowledgeItemRowProps {
  item: KnowledgeItem;
  users: Record<string, string>;
  isExpanded: boolean;
  onToggle: () => void;
  onMarkReviewed: (item: KnowledgeItem) => void;
  onVerify: (item: KnowledgeItem, status: VerificationStatus) => void;
  onEdit: (item: KnowledgeItem) => void;
  onDelete: (item: KnowledgeItem) => void;
  reviewingIds: Set<string>;
  verifyingIds: Set<string>;
  showEmployee?: boolean;
}

function KnowledgeItemRow({
  item,
  users,
  isExpanded,
  onToggle,
  onMarkReviewed,
  onVerify,
  onEdit,
  onDelete,
  reviewingIds,
  verifyingIds,
  showEmployee = true,
}: KnowledgeItemRowProps) {
  const verifiedByName = item.managerVerifiedBy
    ? users[item.managerVerifiedBy] || item.managerVerifiedBy
    : "";
  const reviewedByName = item.reviewedBy
    ? users[item.reviewedBy] || item.reviewedBy
    : "";
  const isRejected = item.managerVerificationStatus === "rejected";

  return (
    <div>
      <div
        className="flex items-start gap-3 px-6 py-4 cursor-pointer hover:bg-navy/[0.02]"
        onClick={onToggle}
      >
        {/* Type badge */}
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium flex-shrink-0 mt-0.5",
            TYPE_COLORS[item.type]
          )}
        >
          {TYPE_ICONS[item.type]}
          {TYPE_LABELS[item.type]}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-navy">{item.title}</p>
            {item.hasGap && item.gapSeverity && (
              <Badge className={GAP_SEVERITY_CLASSES[item.gapSeverity]}>
                {item.gapSeverity}
              </Badge>
            )}
            {isRejected && (
              <Badge variant="ember">
                <XCircle size={12} className="mr-0.5" />
                Rejected
              </Badge>
            )}
            {!isRejected && item.managerVerificationStatus === "pending" && (
              <Badge variant="mist">
                <AlertCircle size={12} className="mr-0.5" />
                Pending Verification
              </Badge>
            )}
          </div>
          {item.description && (
            <p className="text-xs text-mist mt-0.5 line-clamp-1">{item.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {showEmployee && (
              <span className="text-xs text-mist">
                {item.employeeName}
                {item.employeeDepartment ? ` · ${item.employeeDepartment}` : ""}
              </span>
            )}
            {item.successor && (
              <span className="text-xs text-teal">→ {item.successor}</span>
            )}
            {item.flowId && (
              <Link
                to={`/offboardings/${item.flowId}`}
                className="text-xs text-teal hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View offboarding →
              </Link>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-mist hover:text-teal transition-colors p-1"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={14} />
            </a>
          )}
          <Badge
            variant={
              item.status === "reviewed"
                ? "teal"
                : item.status === "submitted"
                  ? "amber"
                  : "mist"
            }
          >
            {item.status === "reviewed"
              ? "Reviewed"
              : item.status === "submitted"
                ? "Submitted"
                : "Draft"}
          </Badge>
          {item.status === "submitted" && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onMarkReviewed(item);
              }}
              loading={reviewingIds.has(item.id)}
            >
              <CheckCircle size={14} className="mr-1" />
              Mark Reviewed
            </Button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
            className="text-mist hover:text-navy transition-colors p-1"
            title="Edit"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            className="text-mist hover:text-ember transition-colors p-1"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expansion panel */}
      {isExpanded && (
        <div className="bg-navy/[0.02] px-6 py-4 border-t border-navy/5 space-y-3">
          {item.hasGap && (
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="font-medium text-amber-900">Knowledge Gap Identified</p>
              <p className="text-amber-700 mt-1">{item.gapReason || "Gap detected"}</p>
            </div>
          )}

          {isRejected && (
            <div className="text-xs bg-ember/5 border border-ember/30 rounded-lg p-3">
              <p className="font-medium text-ember">Manager Rejected This Item</p>
              {verifiedByName && (
                <p className="text-ember/80 mt-1">
                  Rejected by {verifiedByName}
                  {item.managerVerifiedAt?.toDate
                    ? ` on ${format(item.managerVerifiedAt.toDate(), "MMM d, yyyy")}`
                    : ""}
                </p>
              )}
            </div>
          )}

          {item.status === "reviewed" && !item.managerVerified && !isRejected && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-900 flex-1">
                Manager Verification Required
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onVerify(item, "approved")}
                  loading={verifyingIds.has(item.id)}
                  disabled={verifyingIds.has(item.id)}
                >
                  <ThumbsUp size={14} className="mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onVerify(item, "rejected")}
                  loading={verifyingIds.has(item.id)}
                  disabled={verifyingIds.has(item.id)}
                >
                  <ThumbsDown size={14} className="mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          )}

          {item.managerVerified && (
            <div className="flex items-center gap-2 bg-teal/10 border border-teal/30 rounded-lg p-3 text-xs text-teal">
              <CheckCircle size={14} />
              <span>
                Verified by {verifiedByName || "—"}
                {item.managerVerifiedAt?.toDate
                  ? ` on ${format(item.managerVerifiedAt.toDate(), "MMM d, yyyy")}`
                  : ""}
              </span>
            </div>
          )}

          {reviewedByName && (
            <p className="text-xs text-mist">Reviewed by {reviewedByName}</p>
          )}

          {item.verificationHistory && item.verificationHistory.length > 0 && (
            <div className="text-xs space-y-1.5">
              <p className="font-medium text-navy flex items-center gap-1">
                <History size={12} />
                Verification History
              </p>
              {item.verificationHistory.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2 text-mist">
                  {entry.status === "approved" ? (
                    <CheckCircle size={11} className="text-teal flex-shrink-0" />
                  ) : (
                    <XCircle size={11} className="text-ember flex-shrink-0" />
                  )}
                  <span>
                    {entry.status === "approved" ? "Approved" : "Rejected"} by{" "}
                    {users[entry.verifiedBy] || entry.verifiedBy}
                    {entry.verifiedAt?.toDate
                      ? ` · ${format(entry.verifiedAt.toDate(), "MMM d, yyyy h:mm a")}`
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KnowledgeBase() {
  const { companyId, appUser } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<KnowledgeItemType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<KnowledgeItemStatus | "all">("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [gapFilter, setGapFilter] = useState<boolean | "all">("all");
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>("all");
  const [groupByEmployee, setGroupByEmployee] = useState(false);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [reviewingIds, setReviewingIds] = useState<Set<string>>(new Set());
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    try {
      const [data, usersData] = await Promise.all([
        queryDocuments<KnowledgeItem>("knowledgeItems", [
          where("companyId", "==", companyId),
          orderBy("createdAt", "desc"),
        ]),
        queryDocuments<AppUser>("users", [
          where("companyId", "==", companyId),
        ]),
      ]);
      setItems(data);
      const userMap: Record<string, string> = {};
      usersData.forEach((u) => {
        userMap[u.id] = u.displayName || u.email;
      });
      setUsers(userMap);
    } catch {
      showToast("error", "Failed to load knowledge items");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset to first page whenever any filter changes
  useEffect(() => {
    setPage(0);
  }, [search, typeFilter, statusFilter, departmentFilter, gapFilter, verificationFilter, sortField, sortDir]);

  const departments = useMemo(() => {
    const depts = [...new Set(items.map((i) => i.employeeDepartment).filter(Boolean))];
    return depts.sort();
  }, [items]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "createdAt" ? "desc" : "asc");
    }
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (departmentFilter !== "all" && item.employeeDepartment !== departmentFilter) return false;
      if (gapFilter !== "all" && Boolean(item.hasGap) !== gapFilter) return false;
      if (verificationFilter === "pending" && item.managerVerificationStatus !== "pending")
        return false;
      if (verificationFilter === "verified" && !item.managerVerified) return false;
      if (verificationFilter === "rejected" && item.managerVerificationStatus !== "rejected")
        return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          (item.description || "").toLowerCase().includes(q) ||
          item.employeeName.toLowerCase().includes(q) ||
          (item.employeeDepartment ?? "").toLowerCase().includes(q) ||
          (item.gapReason ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, typeFilter, statusFilter, departmentFilter, gapFilter, verificationFilter, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "createdAt") {
        const aMs = a.createdAt?.toDate?.()?.getTime() ?? 0;
        const bMs = b.createdAt?.toDate?.()?.getTime() ?? 0;
        cmp = aMs - bMs;
      } else if (sortField === "title") {
        cmp = a.title.localeCompare(b.title);
      } else if (sortField === "type") {
        cmp = TYPE_LABELS[a.type].localeCompare(TYPE_LABELS[b.type]);
      } else if (sortField === "status") {
        const order: Record<string, number> = { draft: 0, submitted: 1, reviewed: 2 };
        cmp = (order[a.status] ?? 0) - (order[b.status] ?? 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const grouped = useMemo(() => {
    if (!groupByEmployee) return null;
    const groups: Record<string, KnowledgeItem[]> = {};
    for (const item of sorted) {
      const key = item.employeeName || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sorted, groupByEmployee]);

  const totalItems = items.length;
  const reviewedCount = items.filter((i) => i.status === "reviewed").length;
  const gapCount = items.filter((i) => i.hasGap).length;
  const verificationPendingCount = items.filter(
    (i) =>
      i.managerVerificationStatus === "pending" ||
      (!i.managerVerified && i.status === "reviewed")
  ).length;

  async function handleMarkReviewed(item: KnowledgeItem) {
    if (!appUser) return;
    setReviewingIds((prev) => new Set(prev).add(item.id));
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, status: "reviewed" as const, reviewedBy: appUser.id } : i
      )
    );
    try {
      await updateDocument("knowledgeItems", item.id, {
        status: "reviewed",
        reviewedBy: appUser.id,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast("success", "Marked as reviewed");
    } catch {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: "submitted" as const, reviewedBy: "" } : i
        )
      );
      showToast("error", "Failed to mark as reviewed");
    } finally {
      setReviewingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function handleManagerVerification(item: KnowledgeItem, status: VerificationStatus) {
    if (!appUser) return;
    setVerifyingIds((prev) => new Set(prev).add(item.id));
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              managerVerificationStatus: status,
              managerVerified: status === "approved",
              managerVerifiedBy: appUser.id,
              managerVerifiedAt: new Date() as unknown as KnowledgeItem["managerVerifiedAt"],
            }
          : i
      )
    );
    try {
      const verificationHistory = [...(item.verificationHistory || [])];
      verificationHistory.push({
        status,
        verifiedBy: appUser.id,
        verifiedAt: serverTimestamp() as unknown as KnowledgeItem["createdAt"],
      });
      await updateDocument("knowledgeItems", item.id, {
        managerVerificationStatus: status,
        managerVerified: status === "approved",
        managerVerifiedBy: appUser.id,
        managerVerifiedAt: serverTimestamp(),
        verificationHistory,
        updatedAt: serverTimestamp(),
      });
      showToast("success", status === "approved" ? "Item approved" : "Item rejected");
    } catch {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                managerVerificationStatus: item.managerVerificationStatus,
                managerVerified: item.managerVerified,
                managerVerifiedBy: item.managerVerifiedBy,
              }
            : i
        )
      );
      showToast("error", "Verification update failed");
    } finally {
      setVerifyingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function handleEditSave(
    id: string,
    updates: Partial<Pick<KnowledgeItem, "title" | "type" | "description" | "url" | "successor">>
  ) {
    try {
      await updateDocument("knowledgeItems", id, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
      showToast("success", "Knowledge item updated");
    } catch {
      showToast("error", "Failed to update knowledge item");
      throw new Error("Save failed");
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocument("knowledgeItems", deleteTarget.id);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      showToast("success", "Knowledge item deleted");
      setDeleteTarget(null);
    } catch {
      showToast("error", "Failed to delete knowledge item");
    } finally {
      setDeleting(false);
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display text-navy">Knowledge Base</h1>
          <p className="text-sm text-mist mt-1">
            Captured knowledge from departing employees
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => exportToCsv(filtered)}
          disabled={filtered.length === 0}
        >
          <Download size={14} className="mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="space-y-1">
            <p className="text-xs font-medium text-mist">Total Items</p>
            <p className="text-2xl font-semibold text-navy">{totalItems}</p>
          </div>
        </Card>
        <Card>
          <div className="space-y-1">
            <p className="text-xs font-medium text-mist">Reviewed</p>
            <p className="text-2xl font-semibold text-teal">{reviewedCount}</p>
          </div>
        </Card>
        <Card>
          <div className="space-y-1">
            <p className="text-xs font-medium text-mist">Knowledge Gaps</p>
            <p
              className={clsx(
                "text-2xl font-semibold",
                gapCount > 0 ? "text-ember" : "text-navy"
              )}
            >
              {gapCount}
            </p>
          </div>
        </Card>
        <Card>
          <div className="space-y-1">
            <p className="text-xs font-medium text-mist">Needs Verification</p>
            <p
              className={clsx(
                "text-2xl font-semibold",
                verificationPendingCount > 0 ? "text-amber-600" : "text-navy"
              )}
            >
              {verificationPendingCount}
            </p>
          </div>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-mist"
            />
            <input
              type="text"
              placeholder="Search by title, description, or employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
            />
          </div>
          <button
            onClick={() => setGroupByEmployee(!groupByEmployee)}
            className={clsx(
              "px-3 py-2 text-sm border rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap",
              groupByEmployee
                ? "bg-teal/10 border-teal/30 text-teal"
                : "border-navy/10 text-mist hover:text-navy"
            )}
          >
            <Users size={14} />
            Group by employee
          </button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as KnowledgeItemType | "all")}
            className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
          >
            <option value="all">All Types</option>
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as KnowledgeItemStatus | "all")}
            className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="reviewed">Reviewed</option>
          </select>
          <select
            value={gapFilter.toString()}
            onChange={(e) =>
              setGapFilter(e.target.value === "all" ? "all" : e.target.value === "true")
            }
            className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
          >
            <option value="all">All Items</option>
            <option value="true">Has Gaps</option>
            <option value="false">No Gaps</option>
          </select>
          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value as VerificationFilter)}
            className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
          >
            <option value="all">All Verification</option>
            <option value="pending">Needs Verification</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
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
        {/* Sort controls */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-mist">Sort:</span>
          <SortButton field="createdAt" label="Date" />
          <SortButton field="title" label="Title" />
          <SortButton field="type" label="Type" />
          <SortButton field="status" label="Status" />
        </div>
      </div>

      {/* Result count */}
      {filtered.length > 0 && (
        <p className="text-xs text-mist">
          {filtered.length} item{filtered.length !== 1 ? "s" : ""}
          {filtered.length !== totalItems ? ` (filtered from ${totalItems})` : ""}
        </p>
      )}

      {/* Items list */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title={
              totalItems === 0
                ? "No knowledge items captured yet"
                : "No items match your filters"
            }
            description={
              totalItems === 0
                ? "Items submitted by departing employees will appear here."
                : "Try adjusting your search or filters."
            }
          />
        </Card>
      ) : grouped ? (
        <div className="space-y-4">
          {grouped.map(([employeeName, groupItems]) => {
            const firstItem = groupItems[0];
            return (
              <Card key={employeeName} padding="none">
                <div className="px-6 py-3 border-b border-navy/5 bg-navy/[0.02] flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal text-xs font-semibold">
                    {employeeName[0].toUpperCase()}
                  </div>
                  <p className="text-sm font-medium text-navy flex-1">{employeeName}</p>
                  {firstItem.employeeDepartment && (
                    <Badge variant="mist">{firstItem.employeeDepartment}</Badge>
                  )}
                  <span className="text-xs text-mist">
                    {groupItems.length} item{groupItems.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="divide-y divide-navy/5">
                  {groupItems.map((item) => (
                    <KnowledgeItemRow
                      key={item.id}
                      item={item}
                      users={users}
                      isExpanded={expandedIds.has(item.id)}
                      onToggle={() => toggleExpanded(item.id)}
                      onMarkReviewed={handleMarkReviewed}
                      onVerify={handleManagerVerification}
                      onEdit={setEditingItem}
                      onDelete={setDeleteTarget}
                      reviewingIds={reviewingIds}
                      verifyingIds={verifyingIds}
                      showEmployee={false}
                    />
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <>
          <Card padding="none">
            <div className="divide-y divide-navy/5">
              {paginated.map((item) => (
                <KnowledgeItemRow
                  key={item.id}
                  item={item}
                  users={users}
                  isExpanded={expandedIds.has(item.id)}
                  onToggle={() => toggleExpanded(item.id)}
                  onMarkReviewed={handleMarkReviewed}
                  onVerify={handleManagerVerification}
                  onEdit={setEditingItem}
                  onDelete={setDeleteTarget}
                  reviewingIds={reviewingIds}
                  verifyingIds={verifyingIds}
                />
              ))}
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-mist">
                Page {page + 1} of {totalPages} &middot;{" "}
                {sorted.length} total items
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

      {/* Edit Modal */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleEditSave}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          item={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          loading={deleting}
        />
      )}
    </div>
  );
}
