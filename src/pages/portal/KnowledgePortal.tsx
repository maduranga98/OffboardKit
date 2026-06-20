import { useState, useEffect, useCallback, useRef } from "react";
import {
  BookOpen,
  User,
  FileText,
  Video,
  StickyNote,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit2,
  RotateCcw,
  Upload,
  Paperclip,
} from "lucide-react";
import clsx from "clsx";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Progress } from "../../components/ui/Progress";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import {
  subscribeToCollection,
  updateDocument,
  setDocument,
  serverTimestamp,
  where,
} from "../../lib/firestore";
import { storage } from "../../lib/firebase";
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

type FormMode = "new" | "resubmit";

interface EditForm {
  id: string;
  title: string;
  type: KnowledgeItemType;
  description: string;
  url: string;
  successor: string;
}

export default function KnowledgePortal({ flow }: KnowledgePortalProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("new");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form state
  const [editForm, setEditForm] = useState<EditForm>({
    id: "",
    title: "",
    type: "process",
    description: "",
    url: "",
    successor: "",
  });

  const resetToNew = useCallback(() => {
    setFormMode("new");
    setEditForm({ id: "", title: "", type: "process", description: "", url: "", successor: "" });
    setUploadProgress(null);
    setUploadedFileName(null);
  }, []);

  useEffect(() => {
    if (!flow.id) return;
    const unsub = subscribeToCollection<KnowledgeItem>(
      "knowledgeItems",
      [where("flowId", "==", flow.id)],
      (data) => {
        setItems(data.sort((a, b) => {
          const aMs = (a.createdAt as unknown as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
          const bMs = (b.createdAt as unknown as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
          return bMs - aMs;
        }));
        setLoading(false);
      }
    );
    return unsub;
  }, [flow.id]);

  function startResubmit(item: KnowledgeItem) {
    setFormMode("resubmit");
    setEditForm({
      id: item.id,
      title: item.title,
      type: item.type,
      description: item.description || "",
      url: item.url || "",
      successor: item.successor || "",
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  async function handleDocumentUpload(file: File) {
    setSaving(true);
    setUploadProgress(0);
    setErrorMsg(null);
    try {
      const filePath = `companies/${flow.companyId}/knowledge/${flow.id}/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, filePath);
      const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type || "application/octet-stream" });

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snap) => {
            setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
          },
          reject,
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              setEditForm((f) => ({ ...f, url }));
              setUploadedFileName(file.name);
              setUploadProgress(null);
              resolve();
            } catch (err) {
              reject(err);
            }
          }
        );
      });
    } catch {
      setErrorMsg("Failed to upload file. Please try again.");
      setUploadProgress(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!editForm.title.trim()) return;
    setSaving(true);
    setErrorMsg(null);

    try {
      if (formMode === "resubmit" && editForm.id) {
        await updateDocument("knowledgeItems", editForm.id, {
          title: editForm.title.trim(),
          type: editForm.type,
          description: editForm.description.trim(),
          url: editForm.url.trim(),
          successor: editForm.successor.trim(),
          status: "submitted",
          managerVerificationStatus: "pending",
          managerVerified: false,
          managerVerifiedBy: null,
          managerVerifiedAt: null,
          updatedAt: serverTimestamp(),
        });
        setSuccessMsg("Item resubmitted for review");
      } else {
        const id = crypto.randomUUID();
        await setDocument("knowledgeItems", id, {
          id,
          companyId: flow.companyId,
          flowId: flow.id,
          employeeName: flow.employeeName,
          employeeDepartment: flow.employeeDepartment,
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          type: editForm.type,
          url: editForm.url.trim(),
          successor: editForm.successor.trim(),
          status: "submitted",
          submittedBy: "employee",
          reviewedBy: "",
          reviewedAt: null,
          hasGap: false,
          managerVerified: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setSuccessMsg("Item submitted successfully");
      }

      resetToNew();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch {
      setErrorMsg("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Items submitted by the employee have submittedBy === "employee".
  // Items added by HR/admin have a user UID as submittedBy.
  const hrItems = items.filter((i) => i.submittedBy !== "employee" && i.managerVerificationStatus !== "rejected");
  const rejectedItems = items.filter((i) => i.submittedBy === "employee" && i.managerVerificationStatus === "rejected");
  const otherItems = items.filter((i) => i.submittedBy === "employee" && i.managerVerificationStatus !== "rejected");

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
        {items.length} item{items.length !== 1 ? "s" : ""} submitted
        {rejectedItems.length > 0 && (
          <span className="ml-2 flex items-center gap-1 text-ember">
            <XCircle size={14} />
            {rejectedItems.length} rejected
          </span>
        )}
      </div>

      {/* Items assigned by HR/admin — read-only guidance */}
      {hrItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-navy uppercase tracking-wide">
            Assigned by HR — for your reference
          </p>
          {hrItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 bg-teal/5 border border-teal/20 rounded-lg"
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
                <p className="text-sm font-medium text-navy truncate">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-mist truncate">{item.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejected items — needs action */}
      {rejectedItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ember uppercase tracking-wide flex items-center gap-1.5">
            <AlertCircle size={13} />
            Action needed — rejected items
          </p>
          {rejectedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 px-4 py-3 bg-ember/5 border border-ember/20 rounded-lg"
            >
              <span
                className={clsx(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 mt-0.5",
                  TYPE_COLORS[item.type]
                )}
              >
                {TYPE_ICONS[item.type]}
                {TYPE_LABELS[item.type]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-navy">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-mist mt-0.5 line-clamp-1">{item.description}</p>
                )}
                <p className="text-xs text-ember mt-1 flex items-center gap-1">
                  <XCircle size={11} />
                  Rejected by manager — please update and resubmit
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => startResubmit(item)}
                className="flex-shrink-0"
              >
                <Edit2 size={13} className="mr-1" />
                Edit &amp; Resubmit
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Other submitted items */}
      {otherItems.length > 0 && (
        <div className="space-y-2">
          {otherItems.map((item) => (
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
                <p className="text-sm font-medium text-navy truncate">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-mist truncate">{item.description}</p>
                )}
              </div>
              <Badge
                variant={
                  item.managerVerified
                    ? "teal"
                    : item.status === "reviewed"
                      ? "teal"
                      : item.status === "submitted"
                        ? "amber"
                        : "mist"
                }
              >
                {item.managerVerified
                  ? "Approved"
                  : item.status === "reviewed"
                    ? "Reviewed"
                    : item.status === "submitted"
                      ? "Submitted"
                      : "Draft"}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Success / error messages */}
      {successMsg && (
        <div className="flex items-center gap-2 text-sm text-teal bg-teal/5 border border-teal/20 rounded-lg px-4 py-3">
          <CheckCircle size={16} />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 text-sm text-ember bg-ember/5 border border-ember/20 rounded-lg px-4 py-3">
          <AlertCircle size={16} />
          {errorMsg}
        </div>
      )}

      {/* Form */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-navy">
              {formMode === "resubmit" ? (
                <span className="flex items-center gap-1.5">
                  <RotateCcw size={14} className="text-teal" />
                  Edit &amp; Resubmit
                </span>
              ) : (
                "Add Knowledge Item"
              )}
            </h3>
            {formMode === "resubmit" && (
              <button
                onClick={resetToNew}
                className="text-xs text-mist hover:text-navy transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {formMode === "resubmit" && (
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800">
              Update this item and resubmit it for manager review.
            </div>
          )}

          <Input
            label="Title"
            value={editForm.title}
            onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g., How to run the monthly billing report"
          />
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Type</label>
            <select
              value={editForm.type}
              onChange={(e) => {
                setEditForm((f) => ({ ...f, type: e.target.value as KnowledgeItemType, url: "" }));
                setUploadedFileName(null);
                setUploadProgress(null);
              }}
              className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal bg-white"
            >
              {EMPLOYEE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              placeholder="Describe this in detail — who should know this, where to find it, key context..."
              className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none"
            />
          </div>
          {editForm.type === "document" ? (
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Upload Document</label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleDocumentUpload(file);
                  e.target.value = "";
                }}
              />
              {uploadProgress !== null ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-mist">
                    <span>Uploading…</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} max={100} size="sm" color="teal" />
                </div>
              ) : uploadedFileName ? (
                <div className="flex items-center gap-2 px-3 py-2 border border-teal/30 bg-teal/5 rounded-lg">
                  <Paperclip size={14} className="text-teal flex-shrink-0" />
                  <span className="text-sm text-navy truncate flex-1">{uploadedFileName}</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-teal underline flex-shrink-0"
                  >
                    Replace
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-navy/15 rounded-lg py-4 px-4 text-center hover:border-teal/50 hover:bg-teal/5 transition-colors"
                >
                  <Upload size={18} className="text-mist mx-auto mb-1.5" />
                  <p className="text-sm text-mist">Click to upload a document</p>
                  <p className="text-xs text-mist/70 mt-0.5">PDF, Word, Excel, PowerPoint, or image</p>
                </button>
              )}
            </div>
          ) : (
            <Input
              label="URL"
              value={editForm.url}
              onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="Link to document, video, or resource"
            />
          )}
          <Input
            label="Who needs this?"
            value={editForm.successor}
            onChange={(e) => setEditForm((f) => ({ ...f, successor: e.target.value }))}
            placeholder="Name or role of the person who should receive this"
          />
          <Button
            fullWidth
            onClick={handleSubmit}
            loading={saving}
            disabled={!editForm.title.trim()}
          >
            {formMode === "resubmit" ? (
              <>
                <RotateCcw size={14} className="mr-1.5" />
                Resubmit for Review
              </>
            ) : (
              "Submit Item"
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
