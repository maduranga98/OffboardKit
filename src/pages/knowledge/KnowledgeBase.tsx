import { useState, useEffect, useCallback, useMemo } from "react";
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
  GapSeverity,
  VerificationStatus,
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

const GAP_SEVERITY_COLORS: Record<GapSeverity, string> = {
  critical: "bg-ember/10 text-ember",
  high: "bg-orange-50 text-orange-600",
  medium: "bg-amber-50 text-amber-600",
  low: "bg-blue-50 text-blue-600",
};

export default function KnowledgeBase() {
  const { companyId, appUser } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<KnowledgeItemType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<KnowledgeItemStatus | "all">("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [gapFilter, setGapFilter] = useState<boolean | "all">("all");
  const [verificationFilter, setVerificationFilter] = useState<"all" | "pending" | "verified">("all");
  const [groupByEmployee, setGroupByEmployee] = useState(false);
  const [reviewingIds, setReviewingIds] = useState<Set<string>>(new Set());
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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

  const departments = useMemo(() => {
    const depts = [...new Set(items.map((i) => i.employeeDepartment).filter(Boolean))];
    return depts.sort();
  }, [items]);

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
      const verificationHistory = item.verificationHistory || [];
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
    } catch {
      // Revert
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                managerVerificationStatus: undefined,
                managerVerified: false,
                managerVerifiedBy: undefined,
              }
            : i
        )
      );
    } finally {
      setVerifyingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  const filtered = items.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (departmentFilter !== "all" && item.employeeDepartment !== departmentFilter)
      return false;
    if (gapFilter !== "all" && item.hasGap !== gapFilter) return false;
    if (verificationFilter === "pending" && item.managerVerificationStatus !== "pending")
      return false;
    if (verificationFilter === "verified" && !item.managerVerified) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.employeeName.toLowerCase().includes(q) ||
        (item.employeeDepartment ?? "").toLowerCase().includes(q) ||
        (item.gapReason ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const grouped = useMemo(() => {
    if (!groupByEmployee) return null;
    const groups: Record<string, KnowledgeItem[]> = {};
    for (const item of filtered) {
      const key = item.employeeName || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupByEmployee]);

  const totalItems = items.length;
  const reviewedCount = items.filter((i) => i.status === "reviewed").length;
  const gapCount = items.filter((i) => i.hasGap).length;
  const verificationPendingCount = items.filter(
    (i) => i.managerVerificationStatus === "pending" || (!i.managerVerified && i.status === "reviewed")
  ).length;

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
            <p className={clsx(
              "text-2xl font-semibold",
              gapCount > 0 ? "text-ember" : "text-navy"
            )}>{gapCount}</p>
          </div>
        </Card>
        <Card>
          <div className="space-y-1">
            <p className="text-xs font-medium text-mist">Needs Verification</p>
            <p className={clsx(
              "text-2xl font-semibold",
              verificationPendingCount > 0 ? "text-amber-600" : "text-navy"
            )}>{verificationPendingCount}</p>
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
            onChange={(e) =>
              setVerificationFilter(e.target.value as "all" | "pending" | "verified")
            }
            className="px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
          >
            <option value="all">All Verification</option>
            <option value="pending">Needs Verification</option>
            <option value="verified">Verified</option>
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
      </div>

      {/* Items list */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="No knowledge items captured yet"
            description="Items submitted by departing employees will appear here."
          />
        </Card>
      ) : grouped ? (
        <div className="space-y-4">
          {grouped.map(([employeeName, groupItems]) => {
            const firstItem = groupItems[0];
            return (
              <Card key={employeeName} padding="none">
                <div className="px-6 py-3 border-b border-navy/5 bg-navy/2 flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal text-xs font-semibold">
                    {employeeName[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-navy">{employeeName}</p>
                  </div>
                  {firstItem.employeeDepartment && (
                    <Badge variant="mist">{firstItem.employeeDepartment}</Badge>
                  )}
                  <span className="text-xs text-mist">{groupItems.length} item{groupItems.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-navy/5">
                  {groupItems.map((item) => (
                    <div key={item.id}>
                      <div
                        className="flex items-start gap-3 px-6 py-4 cursor-pointer hover:bg-navy/[0.02]"
                        onClick={() =>
                          setExpandedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          })
                        }
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
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-navy">{item.title}</p>
                            {item.hasGap && item.gapSeverity && (
                              <Badge variant={GAP_SEVERITY_COLORS[item.gapSeverity] as any}>
                                {item.gapSeverity}
                              </Badge>
                            )}
                            {item.managerVerificationStatus === "pending" && (
                              <Badge variant="mist">
                                <AlertCircle size={12} className="mr-0.5" />
                                Pending Verification
                              </Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-mist mt-0.5 line-clamp-1">
                              {item.description}
                            </p>
                          )}
                          {item.successor && (
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-teal">
                                → {item.successor}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-mist hover:text-teal transition-colors"
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
                                handleMarkReviewed(item);
                              }}
                              loading={reviewingIds.has(item.id)}
                            >
                              <CheckCircle size={14} className="mr-1" />
                              Mark Reviewed
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Expansion: Gap and Verification Details */}
                      {expandedIds.has(item.id) && (
                        <div className="bg-navy/[0.02] px-6 py-4 border-t border-navy/5 space-y-3">
                          {item.hasGap && (
                            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <p className="font-medium text-amber-900">Knowledge Gap Identified</p>
                              <p className="text-amber-700 mt-1">{item.gapReason || "Gap detected"}</p>
                            </div>
                          )}

                          {item.status === "reviewed" && !item.managerVerified && (
                            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <div className="flex-1">
                                <p className="text-xs font-medium text-blue-900">
                                  Manager Verification Required
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    handleManagerVerification(item, "approved");
                                  }}
                                  loading={verifyingIds.has(item.id)}
                                  disabled={verifyingIds.has(item.id)}
                                >
                                  <ThumbsUp size={14} className="mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    handleManagerVerification(item, "rejected");
                                  }}
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
                              <span>Verified by {item.managerVerifiedBy}</span>
                            </div>
                          )}

                          {item.verificationHistory && item.verificationHistory.length > 0 && (
                            <div className="text-xs space-y-1">
                              <p className="font-medium text-navy flex items-center gap-1">
                                <History size={12} />
                                Verification History
                              </p>
                              {item.verificationHistory.map((entry, idx) => (
                                <div key={idx} className="text-mist">
                                  {entry.status === "approved" ? "✓" : "✗"} {entry.status} by {entry.verifiedBy}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-navy/5">
            {filtered.map((item) => (
              <div key={item.id}>
                <div
                  className="flex items-start gap-3 px-6 py-4 cursor-pointer hover:bg-navy/[0.02]"
                  onClick={() =>
                    setExpandedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    })
                  }
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-navy">{item.title}</p>
                      {item.hasGap && item.gapSeverity && (
                        <Badge variant={GAP_SEVERITY_COLORS[item.gapSeverity] as any}>
                          {item.gapSeverity}
                        </Badge>
                      )}
                      {item.managerVerificationStatus === "pending" && (
                        <Badge variant="mist">
                          <AlertCircle size={12} className="mr-0.5" />
                          Pending Verification
                        </Badge>
                      )}
                    </div>
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
                          handleMarkReviewed(item);
                        }}
                        loading={reviewingIds.has(item.id)}
                      >
                        <CheckCircle size={14} className="mr-1" />
                        Mark Reviewed
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expansion: Gap and Verification Details */}
                {expandedIds.has(item.id) && (
                  <div className="bg-navy/[0.02] px-6 py-4 border-t border-navy/5 space-y-3">
                    {item.hasGap && (
                      <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="font-medium text-amber-900">Knowledge Gap Identified</p>
                        <p className="text-amber-700 mt-1">{item.gapReason || "Gap detected"}</p>
                      </div>
                    )}

                    {item.status === "reviewed" && !item.managerVerified && (
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-blue-900">
                            Manager Verification Required
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              handleManagerVerification(item, "approved");
                            }}
                            loading={verifyingIds.has(item.id)}
                            disabled={verifyingIds.has(item.id)}
                          >
                            <ThumbsUp size={14} className="mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              handleManagerVerification(item, "rejected");
                            }}
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
                        <span>Verified by {item.managerVerifiedBy}</span>
                      </div>
                    )}

                    {item.verificationHistory && item.verificationHistory.length > 0 && (
                      <div className="text-xs space-y-1">
                        <p className="font-medium text-navy flex items-center gap-1">
                          <History size={12} />
                          Verification History
                        </p>
                        {item.verificationHistory.map((entry, idx) => (
                          <div key={idx} className="text-mist">
                            {entry.status === "approved" ? "✓" : "✗"} {entry.status} by {entry.verifiedBy}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
