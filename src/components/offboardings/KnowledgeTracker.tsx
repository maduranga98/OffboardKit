import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  User,
  FileText,
  Key,
  Video,
  StickyNote,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";
import { showToast } from "../ui/Toast";
import clsx from "clsx";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { Progress } from "../ui/Progress";
import { EmptyState } from "../shared/EmptyState";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { useAuth } from "../../hooks/useAuth";
import {
  queryDocuments,
  setDocument,
  updateDocument,
  deleteDocument,
  serverTimestamp,
  where,
  orderBy,
} from "../../lib/firestore";
import type {
  KnowledgeItem,
  KnowledgeItemType,
  GapSeverity,
  VerificationStatus,
} from "../../types/knowledge.types";
import type { OffboardFlow } from "../../types/offboarding.types";

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

interface KnowledgeTrackerProps {
  flow: OffboardFlow;
  onScoreUpdate?: (score: number) => void;
}

interface KnowledgeGapAnalysis {
  completenessScore: number;
  gaps: {
    area: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    suggestedPrompt: string;
  }[];
  strengths: string[];
  overallAssessment: string;
}

export default function KnowledgeTracker({
  flow,
  onScoreUpdate,
}: KnowledgeTrackerProps) {
  const { appUser } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewingIds, setReviewingIds] = useState<Set<string>>(new Set());
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [gapAnalysis, setGapAnalysis] = useState<KnowledgeGapAnalysis | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<KnowledgeItemType>("process");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [successor, setSuccessor] = useState("");

  const loadItems = useCallback(async () => {
    try {
      const data = await queryDocuments<KnowledgeItem>("knowledgeItems", [
        where("flowId", "==", flow.id),
        orderBy("createdAt", "desc"),
      ]);
      setItems(data);
    } catch {
      // Error loading
    } finally {
      setLoading(false);
    }
  }, [flow.id]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function updateScore(updatedItems: KnowledgeItem[]) {
    const score =
      updatedItems.length === 0
        ? 0
        : Math.round(
            (updatedItems.filter((i) => i.status === "reviewed").length /
              updatedItems.length) *
              100
          );
    try {
      await updateDocument("offboardFlows", flow.id, {
        "completionScores.knowledge": score,
      });
      onScoreUpdate?.(score);
    } catch {
      // Score update failed
    }
  }

  async function handleAddItem() {
    if (!title.trim() || !appUser) return;
    setSaving(true);

    const id = crypto.randomUUID();
    const newItem: KnowledgeItem = {
      id,
      companyId: flow.companyId,
      flowId: flow.id,
      employeeName: flow.employeeName,
      employeeDepartment: flow.employeeDepartment,
      title: title.trim(),
      description: description.trim(),
      type,
      url: url.trim(),
      successor: successor.trim(),
      status: "submitted",
      submittedBy: appUser.id,
      reviewedBy: "",
      reviewedAt: null,
      createdAt: null as unknown as KnowledgeItem["createdAt"],
      updatedAt: null as unknown as KnowledgeItem["updatedAt"],
    };

    try {
      await setDocument("knowledgeItems", id, {
        id,
        companyId: flow.companyId,
        flowId: flow.id,
        employeeName: flow.employeeName,
        employeeDepartment: flow.employeeDepartment,
        title: title.trim(),
        description: description.trim(),
        type,
        url: url.trim(),
        successor: successor.trim(),
        status: "submitted",
        submittedBy: appUser.id,
        reviewedBy: "",
        reviewedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const updatedItems = [newItem, ...items];
      setItems(updatedItems);
      await updateScore(updatedItems);

      // Reset form
      setTitle("");
      setDescription("");
      setType("process");
      setUrl("");
      setSuccessor("");
      setShowForm(false);
    } catch {
      // Error saving
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkReviewed(item: KnowledgeItem) {
    if (!appUser) return;
    setReviewingIds((prev) => new Set(prev).add(item.id));

    const updatedItems = items.map((i) =>
      i.id === item.id
        ? { ...i, status: "reviewed" as const, reviewedBy: appUser.id }
        : i
    );
    setItems(updatedItems);

    try {
      await updateDocument("knowledgeItems", item.id, {
        status: "reviewed",
        reviewedBy: appUser.id,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateScore(updatedItems);
    } catch {
      setItems(items);
    } finally {
      setReviewingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function handleDelete(item: KnowledgeItem) {
    const confirmed = window.confirm(
      `Delete "${item.title}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingIds((prev) => new Set(prev).add(item.id));

    const updatedItems = items.filter((i) => i.id !== item.id);
    setItems(updatedItems);

    try {
      await deleteDocument("knowledgeItems", item.id);
      await updateScore(updatedItems);
    } catch {
      setItems(items);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function handleManagerVerification(item: KnowledgeItem, status: VerificationStatus) {
    if (!appUser) return;
    setVerifyingIds((prev) => new Set(prev).add(item.id));

    const updatedItems = items.map((i) =>
      i.id === item.id
        ? {
            ...i,
            managerVerificationStatus: status,
            managerVerified: status === "approved",
            managerVerifiedBy: appUser.id,
            managerVerifiedAt: new Date() as unknown as KnowledgeItem["managerVerifiedAt"],
          }
        : i
    );
    setItems(updatedItems);

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
      setItems(items);
    } finally {
      setVerifyingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function handleAnalyzeGaps() {
    setAnalyzing(true);
    try {
      const detectGaps = httpsCallable(functions, "detectKnowledgeGaps");
      const result = await detectGaps({ flowId: flow.id });
      setGapAnalysis(result.data as KnowledgeGapAnalysis);
    } catch (error) {
      console.error("Gap analysis failed:", error);
      showToast("error", "Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  const reviewedCount = items.filter((i) => i.status === "reviewed").length;
  const progressValue =
    items.length === 0
      ? 0
      : Math.round((reviewedCount / items.length) * 100);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-display text-navy">Knowledge Transfer</h2>
          <p className="text-sm text-mist mt-1">
            {items.length} items captured · {reviewedCount} reviewed
          </p>
          <div className="mt-2 max-w-xs">
            <Progress value={progressValue} size="sm" color="teal" />
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} className="mr-1.5" />
          Add Item
        </Button>
      </div>

      {/* Add Item Form */}
      {showForm && (
        <Card>
          <div className="space-y-4">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Monthly billing reconciliation process"
            />
            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as KnowledgeItemType)}
                className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
              >
                {Object.entries(TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Description
              </label>
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
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddItem}
                loading={saving}
                disabled={!title.trim()}
              >
                Add Item
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="No knowledge items yet"
            description="Add items or wait for the employee to submit via their portal."
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-navy/5">
            {items.map((item) => (
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
                      <span className="text-xs text-teal mt-0.5 inline-block">
                        → {item.successor}
                      </span>
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item);
                      }}
                      disabled={deletingIds.has(item.id)}
                      className="text-mist hover:text-ember transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
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
                            onClick={() => handleManagerVerification(item, "approved")}
                            loading={verifyingIds.has(item.id)}
                            disabled={verifyingIds.has(item.id)}
                          >
                            <ThumbsUp size={14} className="mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleManagerVerification(item, "rejected")}
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
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* AI Gap Analysis Section */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-navy">AI Knowledge Gap Analysis</h3>
            <p className="text-xs text-mist mt-0.5">
              Analyze what knowledge may be missing from the handover
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleAnalyzeGaps}
            loading={analyzing}
            disabled={analyzing}
          >
            {analyzing ? "Analyzing..." : gapAnalysis ? "Re-analyze" : "Analyze Gaps"}
          </Button>
        </div>

        {gapAnalysis && (
          <div className="space-y-4">
            {/* Completeness Score */}
            <div className="flex items-center gap-3">
              <Progress value={gapAnalysis.completenessScore} size="sm" />
              <span className="text-sm font-semibold text-navy">
                {gapAnalysis.completenessScore}%
              </span>
            </div>

            {/* Overall Assessment */}
            <p className="text-sm text-navy bg-navy/[0.02] rounded-lg p-3 border border-navy/5">
              {gapAnalysis.overallAssessment}
            </p>

            {/* Gaps */}
            {gapAnalysis.gaps.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-mist uppercase tracking-wide">
                  Identified Gaps
                </h4>
                {gapAnalysis.gaps.map((gap, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-navy/5">
                    <Badge
                      variant={
                        gap.severity === "critical" ? "ember" :
                        gap.severity === "high" ? "amber" :
                        "mist"
                      }
                    >
                      {gap.severity}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy">{gap.area}</p>
                      <p className="text-xs text-mist mt-0.5">{gap.description}</p>
                      <p className="text-xs text-teal mt-1 italic">
                        Ask: &ldquo;{gap.suggestedPrompt}&rdquo;
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Strengths */}
            {gapAnalysis.strengths.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-mist uppercase tracking-wide">
                  Well Documented
                </h4>
                {gapAnalysis.strengths.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-navy">
                    <CheckCircle size={14} className="text-teal flex-shrink-0" />
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
