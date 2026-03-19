import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/shared/EmptyState";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { useAuth } from "../../hooks/useAuth";
import {
  queryDocuments,
  updateDocument,
  serverTimestamp,
  where,
  orderBy,
} from "../../lib/firestore";
import type {
  KnowledgeItem,
  KnowledgeItemType,
  KnowledgeItemStatus,
} from "../../types/knowledge.types";

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

export default function KnowledgeBase() {
  const { companyId, appUser } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<KnowledgeItemType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<KnowledgeItemStatus | "all">("all");
  const [reviewingIds, setReviewingIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await queryDocuments<KnowledgeItem>("knowledgeItems", [
        where("companyId", "==", companyId),
        orderBy("createdAt", "desc"),
      ]);
      setItems(data);
    } catch {
      // Error loading
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleMarkReviewed(item: KnowledgeItem) {
    if (!appUser) return;
    setReviewingIds((prev) => new Set(prev).add(item.id));

    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, status: "reviewed" as const, reviewedBy: appUser.id }
          : i
      )
    );

    try {
      await updateDocument("knowledgeItems", item.id, {
        status: "reviewed",
        reviewedBy: appUser.id,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Revert
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: "submitted" as const, reviewedBy: "" } : i
        )
      );
    } finally {
      setReviewingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  const filtered = items.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.employeeName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalItems = items.length;
  const reviewedCount = items.filter((i) => i.status === "reviewed").length;
  const pendingCount = items.filter((i) => i.status === "submitted").length;

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
        <h1 className="text-2xl font-display text-navy">Knowledge Base</h1>
        <p className="text-sm text-mist mt-1">
          Captured knowledge from departing employees
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <p className="text-xs font-medium text-mist">Pending Review</p>
            <p className="text-2xl font-semibold text-amber-600">{pendingCount}</p>
          </div>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
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
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as KnowledgeItemType | "all")
          }
          className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
        >
          <option value="all">All Types</option>
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as KnowledgeItemStatus | "all")
          }
          className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="reviewed">Reviewed</option>
        </select>
      </div>

      {/* Items list */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="No knowledge items captured yet"
            description="Items submitted by departing employees will appear here."
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-navy/5">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 px-6 py-4"
              >
                {/* Type icon */}
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
                  <p className="text-sm font-medium text-navy">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-mist mt-0.5 line-clamp-1">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-mist">
                      {item.employeeName} · {item.employeeDepartment}
                    </span>
                    {item.successor && (
                      <span className="text-xs text-teal">
                        → {item.successor}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-mist hover:text-teal transition-colors"
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
                      onClick={() => handleMarkReviewed(item)}
                      loading={reviewingIds.has(item.id)}
                    >
                      <CheckCircle size={14} className="mr-1" />
                      Mark Reviewed
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
