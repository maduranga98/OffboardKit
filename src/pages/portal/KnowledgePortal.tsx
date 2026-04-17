import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  User,
  FileText,
  Video,
  StickyNote,
  CheckCircle,
} from "lucide-react";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import {
  queryDocuments,
  setDocument,
  serverTimestamp,
  where,
} from "../../lib/firestore";
import type {
  KnowledgeItem,
  KnowledgeItemType,
} from "../../types/knowledge.types";
import type { OffboardFlow } from "../../types/offboarding.types";

const EMPLOYEE_TYPES: { value: KnowledgeItemType; label: string }[] = [
  { value: "process", label: "Process" },
  { value: "contact", label: "Contact" },
  { value: "document", label: "Document" },
  { value: "video_link", label: "Video Link" },
  { value: "note", label: "Note" },
];

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
  credential_handover: null,
  video_link: <Video size={14} />,
  note: <StickyNote size={14} />,
};

interface KnowledgePortalProps {
  flow: OffboardFlow;
}

export default function KnowledgePortal({ flow }: KnowledgePortalProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

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

  async function handleSubmit() {
    if (!title.trim()) return;
    setSaving(true);

    const id = crypto.randomUUID();

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
        submittedBy: "employee",
        reviewedBy: "",
        reviewedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const newItem: KnowledgeItem = {
        id,
        companyId: flow.companyId,
        flowId: flow.id,
        employeeName: flow.employeeName,
        employeeDepartment: flow.employeeDepartment,
        title: title.trim(),
        description: description.trim(),
        hasGap: false,
        managerVerified: false,
        type,
        url: url.trim(),
        successor: successor.trim(),
        status: "submitted",
        submittedBy: "employee",
        reviewedBy: "",
        reviewedAt: null,
        createdAt: null as unknown as KnowledgeItem["createdAt"],
        updatedAt: null as unknown as KnowledgeItem["updatedAt"],
      };

      setItems((prev) => [newItem, ...prev]);

      // Reset form
      setTitle("");
      setDescription("");
      setType("process");
      setUrl("");
      setSuccessor("");

      // Show success message
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
    } catch {
      // Error saving
    } finally {
      setSaving(false);
    }
  }

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
      <div>
        <h2 className="text-lg font-display text-navy">Knowledge Transfer</h2>
        <p className="text-sm text-mist mt-1">
          Document your processes and knowledge before your last day.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-sm text-mist">
        <CheckCircle size={16} className="text-teal" />
        {items.length} items submitted
      </div>

      {/* Existing items list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 bg-white border border-navy/5 rounded-lg"
            >
              <span
                className={clsx(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0",
                  TYPE_COLORS[item.type]
                )}
              >
                {TYPE_ICONS[item.type]}
                {TYPE_LABELS[item.type]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-navy truncate">
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-xs text-mist truncate">{item.description}</p>
                )}
              </div>
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
            </div>
          ))}
        </div>
      )}

      {/* Success message */}
      {successMsg && (
        <div className="flex items-center gap-2 text-sm text-teal bg-teal/5 border border-teal/20 rounded-lg px-4 py-3">
          <CheckCircle size={16} />
          Item submitted
        </div>
      )}

      {/* Add new item form */}
      <Card>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-navy">
            Add Knowledge Item
          </h3>
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., How to run the monthly billing report"
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
              {EMPLOYEE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
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
              rows={4}
              placeholder="Describe this in detail — who should know this, where to find it, key context..."
              className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none"
            />
          </div>
          <Input
            label="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link to document, video, or resource"
          />
          <Input
            label="Who needs this?"
            value={successor}
            onChange={(e) => setSuccessor(e.target.value)}
            placeholder="Name or role of the person who should receive this"
          />
          <Button
            fullWidth
            onClick={handleSubmit}
            loading={saving}
            disabled={!title.trim()}
          >
            Submit Item
          </Button>
        </div>
      </Card>
    </div>
  );
}
