import { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText,
  BadgeCheck,
  Zap,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
} from "lucide-react";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { showToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";
import {
  queryDocuments,
  setDocument,
  updateDocument,
  serverTimestamp,
  where,
  orderBy,
} from "../../lib/firestore";
import type { DocRequest, DocRequestType, RequestPurpose, RequestUrgency } from "../../types/docRequests.types";
import {
  DOC_TYPE_CONFIG,
  PURPOSE_LABELS,
  STATUS_CONFIG,
} from "../../types/docRequests.types";
import type { Timestamp } from "firebase/firestore";
import type { AlumniProfile } from "../../types/alumni.types";
import { Modal } from "../../components/ui/Modal";

interface Props {
  companyId: string;
}

type StatusFilter = "all" | "pending" | "approved" | "delivered" | "rejected";

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

export default function DocRequestsPanel({ companyId }: Props) {
  const { appUser } = useAuth();
  const [requests, setRequests] = useState<DocRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionText, setRejectionText] = useState<Record<string, string>>({});
  const [showNotes, setShowNotes] = useState<Record<string, boolean>>({});
  const [notesText, setNotesText] = useState<Record<string, string>>({});
  const pollIntervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [allAlumni, setAllAlumni] = useState<AlumniProfile[]>([]);
  const [newReqAlumniId, setNewReqAlumniId] = useState("");
  const [newReqType, setNewReqType] = useState<DocRequestType>("reference_letter");
  const [newReqPurpose, setNewReqPurpose] = useState<RequestPurpose>("job_application");
  const [newReqDetails, setNewReqDetails] = useState("");
  const [newReqUrgency, setNewReqUrgency] = useState<RequestUrgency>("standard");
  const [creatingReq, setCreatingReq] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      const data = await queryDocuments<DocRequest>("docRequests", [
        where("companyId", "==", companyId),
        orderBy("createdAt", "desc"),
      ]);
      setRequests(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    queryDocuments<AlumniProfile>("alumniProfiles", [
      where("companyId", "==", companyId),
      orderBy("name", "asc"),
    ]).then(setAllAlumni).catch(() => {});
  }, [companyId]);

  useEffect(() => {
    const intervals = pollIntervals.current;
    return () => {
      intervals.forEach((id) => clearInterval(id));
    };
  }, []);

  function startPolling(requestId: string) {
    if (pollIntervals.current.has(requestId)) return;
    const interval = setInterval(async () => {
      const updated = await queryDocuments<DocRequest>("docRequests", [
        where("id", "==", requestId),
      ]);
      if (updated[0]?.status === "delivered") {
        clearInterval(pollIntervals.current.get(requestId)!);
        pollIntervals.current.delete(requestId);
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? updated[0] : r))
        );
        showToast("success", "✓ Document generated and sent to alumni");
      }
    }, 3000);
    pollIntervals.current.set(requestId, interval);
  }

  async function handleApprove(req: DocRequest) {
    if (!appUser) return;
    setApprovingId(req.id);
    try {
      await updateDocument("docRequests", req.id, {
        status: "approved",
        approvedBy: appUser.id,
        approvedByName: appUser.displayName,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id
            ? { ...r, status: "approved", approvedBy: appUser.id, approvedByName: appUser.displayName }
            : r
        )
      );
      startPolling(req.id);
    } catch {
      showToast("error", "Failed to approve request");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject(req: DocRequest) {
    const reason = rejectionText[req.id] ?? "";
    if (!reason.trim()) {
      showToast("error", "Please provide a rejection reason");
      return;
    }
    try {
      await updateDocument("docRequests", req.id, {
        status: "rejected",
        rejectionReason: reason,
        updatedAt: serverTimestamp(),
      });
      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id ? { ...r, status: "rejected", rejectionReason: reason } : r
        )
      );
      setRejectingId(null);
    } catch {
      showToast("error", "Failed to reject request");
    }
  }

  async function handleCreateRequest() {
    const alumni = allAlumni.find((a) => a.id === newReqAlumniId);
    if (!alumni || !appUser) return;
    setCreatingReq(true);
    try {
      const requestId = crypto.randomUUID();
      await setDocument("docRequests", requestId, {
        id: requestId,
        companyId,
        alumniId: alumni.id,
        alumniName: alumni.name,
        alumniEmail: alumni.email,
        type: newReqType,
        purpose: newReqPurpose,
        purposeDetails: newReqDetails,
        urgency: newReqUrgency,
        status: "pending",
        hrNotes: "",
        rejectionReason: null,
        documentUrl: null,
        approvedBy: null,
        approvedByName: null,
        approvedAt: null,
        deliveredAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await loadRequests();
      setShowCreateModal(false);
      setNewReqAlumniId("");
      setNewReqDetails("");
      showToast("success", "Request created", `Document request created for ${alumni.name}`);
    } catch {
      showToast("error", "Failed to create request");
    } finally {
      setCreatingReq(false);
    }
  }

  async function handleReconsider(req: DocRequest) {
    try {
      await updateDocument("docRequests", req.id, {
        status: "pending",
        rejectionReason: null,
        updatedAt: serverTimestamp(),
      });
      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id ? { ...r, status: "pending", rejectionReason: null } : r
        )
      );
    } catch {
      showToast("error", "Failed to reconsider");
    }
  }

  async function saveNotes(req: DocRequest) {
    const notes = notesText[req.id] ?? req.hrNotes;
    try {
      await updateDocument("docRequests", req.id, {
        hrNotes: notes,
        updatedAt: serverTimestamp(),
      });
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, hrNotes: notes } : r))
      );
      showToast("success", "Notes saved");
    } catch {
      showToast("error", "Failed to save notes");
    }
  }

  const filtered = requests
    .filter((r) => filter === "all" || r.status === filter)
    .sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (b.status === "pending" && a.status !== "pending") return 1;
      if (a.status === "pending" && b.status === "pending") {
        if (a.urgency === "urgent" && b.urgency !== "urgent") return -1;
        if (b.urgency === "urgent" && a.urgency !== "urgent") return 1;
      }
      const aDate = toDate(a.createdAt);
      const bDate = toDate(b.createdAt);
      if (!aDate || !bDate) return 0;
      return bDate.getTime() - aDate.getTime();
    });

  const pending = requests.filter((r) => r.status === "pending").length;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const deliveredThisMonth = requests.filter((r) => {
    if (r.status !== "delivered") return false;
    const d = toDate(r.deliveredAt);
    return d && d >= startOfMonth;
  }).length;

  const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "delivered", label: "Delivered" },
    { value: "rejected", label: "Rejected" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-teal" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-navy">Document Requests</h2>
          <p className="text-sm text-mist mt-0.5">
            Reference letters and employment verification requests from alumni
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={14} className="mr-1.5" />
          Create Request
        </Button>
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Document Request"
        size="md"
        footer={
          <div className="flex justify-end gap-2 pt-4 border-t border-navy/5">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button
              onClick={handleCreateRequest}
              loading={creatingReq}
              disabled={!newReqAlumniId}
            >
              Create Request
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Alumni <span className="text-ember">*</span></label>
            <select
              value={newReqAlumniId}
              onChange={(e) => setNewReqAlumniId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 bg-white"
            >
              <option value="">Select alumni…</option>
              {allAlumni.map((a) => (
                <option key={a.id} value={a.id}>{a.name} — {a.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Document Type</label>
            <select
              value={newReqType}
              onChange={(e) => setNewReqType(e.target.value as DocRequestType)}
              className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 bg-white"
            >
              <option value="reference_letter">Reference Letter</option>
              <option value="employment_verification">Employment Verification</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Purpose</label>
            <select
              value={newReqPurpose}
              onChange={(e) => setNewReqPurpose(e.target.value as RequestPurpose)}
              className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 bg-white"
            >
              {(Object.entries(PURPOSE_LABELS) as [RequestPurpose, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Details</label>
            <textarea
              rows={3}
              value={newReqDetails}
              onChange={(e) => setNewReqDetails(e.target.value)}
              placeholder="Add any relevant details for this request…"
              className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1">Processing Time</label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="urgency" value="standard" checked={newReqUrgency === "standard"} onChange={() => setNewReqUrgency("standard")} className="accent-teal" />
                <span className="text-sm text-navy">Standard (3–5 business days)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="urgency" value="urgent" checked={newReqUrgency === "urgent"} onChange={() => setNewReqUrgency("urgent")} className="accent-teal" />
                <span className="text-sm text-navy">Urgent (within 24 hours)</span>
              </label>
            </div>
          </div>
        </div>
      </Modal>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-xs text-mist font-medium mb-1">Pending Review</div>
          <div className="text-2xl font-semibold text-navy">{pending}</div>
        </Card>
        <Card>
          <div className="text-xs text-mist font-medium mb-1">Delivered This Month</div>
          <div className="text-2xl font-semibold text-teal">{deliveredThisMonth}</div>
        </Card>
        <Card>
          <div className="text-xs text-mist font-medium mb-1">Total Requests</div>
          <div className="text-2xl font-semibold text-navy">{requests.length}</div>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-navy/5 rounded-md p-1 w-fit">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={clsx(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              filter === value ? "bg-white text-navy shadow-sm" : "text-mist hover:text-navy"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Request cards */}
      {filtered.length === 0 ? (
        <Card>
          <div className="py-8 text-center text-sm text-mist">
            No requests found.
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const typeConfig = DOC_TYPE_CONFIG[req.type];
            const statusConfig = STATUS_CONFIG[req.status];
            const createdDate = toDate(req.createdAt);
            const isApproving = approvingId === req.id;
            const isRejecting = rejectingId === req.id;
            const notesOpen = showNotes[req.id] ?? false;

            return (
              <div
                key={req.id}
                className="bg-white border border-navy/10 rounded-xl p-4 space-y-3"
              >
                {/* Top row */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                        req.type === "reference_letter"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-teal/10 text-teal"
                      )}
                    >
                      {req.type === "reference_letter" ? (
                        <FileText size={11} />
                      ) : (
                        <BadgeCheck size={11} />
                      )}
                      {typeConfig.label}
                    </span>
                    {req.urgency === "urgent" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-ember/10 text-ember">
                        <Zap size={11} />
                        Urgent
                      </span>
                    )}
                  </div>
                  <span
                    className={clsx(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      statusConfig.color
                    )}
                  >
                    {statusConfig.label}
                  </span>
                </div>

                {/* Middle row */}
                <div>
                  <div className="text-sm font-semibold text-navy">{req.alumniName}</div>
                  <div className="text-xs text-mist mt-0.5">
                    {PURPOSE_LABELS[req.purpose]}
                    {createdDate && (
                      <span className="ml-2">
                        · Requested{" "}
                        {formatDistanceToNow(createdDate, { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  {req.purposeDetails && (
                    <div className="text-xs text-mist italic mt-1 line-clamp-2">
                      {req.purposeDetails}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {req.status === "pending" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        loading={isApproving}
                        onClick={() => handleApprove(req)}
                      >
                        Approve & Generate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-ember"
                        onClick={() =>
                          setRejectingId(isRejecting ? null : req.id)
                        }
                      >
                        Reject
                      </Button>
                      <button
                        onClick={() =>
                          setShowNotes((prev) => ({ ...prev, [req.id]: !prev[req.id] }))
                        }
                        className="ml-auto flex items-center gap-1 text-xs text-mist hover:text-navy transition-colors"
                      >
                        Add notes
                        {notesOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>

                    {notesOpen && (
                      <div className="space-y-1">
                        <textarea
                          rows={2}
                          value={notesText[req.id] ?? req.hrNotes}
                          onChange={(e) =>
                            setNotesText((prev) => ({
                              ...prev,
                              [req.id]: e.target.value,
                            }))
                          }
                          placeholder="Internal HR notes (not shared with alumni)…"
                          className="w-full px-3 py-2 text-xs border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 resize-none"
                        />
                        <Button size="sm" variant="ghost" onClick={() => saveNotes(req)}>
                          Save notes
                        </Button>
                      </div>
                    )}

                    {isRejecting && (
                      <div className="space-y-2 pt-1">
                        <textarea
                          rows={2}
                          value={rejectionText[req.id] ?? ""}
                          onChange={(e) =>
                            setRejectionText((prev) => ({
                              ...prev,
                              [req.id]: e.target.value,
                            }))
                          }
                          placeholder="Reason for rejection (will be shared with alumni)…"
                          className="w-full px-3 py-2 text-xs border border-ember/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-ember/30 resize-none"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-ember"
                          onClick={() => handleReject(req)}
                        >
                          Confirm Rejection
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {req.status === "approved" && (
                  <div className="flex items-center gap-2 text-xs text-mist">
                    <Loader2 size={12} className="animate-spin" />
                    Generating document…
                  </div>
                )}

                {req.status === "delivered" && (
                  <div className="flex items-center gap-2">
                    {req.documentUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(req.documentUrl!, "_blank")}
                      >
                        <ExternalLink size={13} className="mr-1" />
                        View Document
                      </Button>
                    )}
                  </div>
                )}

                {req.status === "rejected" && (
                  <div className="flex items-center gap-3">
                    {req.rejectionReason && (
                      <p className="text-xs text-mist italic flex-1">
                        Rejection reason: {req.rejectionReason}
                      </p>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-teal flex-shrink-0"
                      onClick={() => handleReconsider(req)}
                    >
                      Reconsider
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
