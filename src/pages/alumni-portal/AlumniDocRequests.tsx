import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  BadgeCheck,
  CheckCircle,
  Circle,
  Download,
  Loader2,
} from "lucide-react";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { showToast } from "../../components/ui/Toast";
import { useAlumniAuth } from "../../hooks/useAlumniAuth";
import {
  queryDocuments,
  setDocument,
  serverTimestamp,
  where,
  orderBy,
} from "../../lib/firestore";
import type {
  DocRequest,
  DocRequestType,
  RequestPurpose,
  RequestUrgency,
} from "../../types/docRequests.types";
import {
  DOC_TYPE_CONFIG,
  PURPOSE_LABELS,
  STATUS_CONFIG,
} from "../../types/docRequests.types";
import type { Timestamp } from "firebase/firestore";

function toDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === "function") return (ts as Timestamp).toDate();
  return null;
}

const PURPOSE_PLACEHOLDERS: Record<RequestPurpose, string> = {
  job_application: "e.g. I'm applying to [Company] as a Product Manager",
  visa: "e.g. UK Skilled Worker Visa application",
  loan: "e.g. Mortgage application with Halifax Bank",
  rental: "e.g. Rental agreement for apartment",
  other: "Please provide any relevant details",
};

const TIMELINE_STEPS = ["Submitted", "HR Review", "Document Generated", "Delivered"];

function getTimelineStep(status: DocRequest["status"]): number {
  switch (status) {
    case "pending": return 1;
    case "approved": return 2;
    case "delivered": return 3;
    default: return 0;
  }
}

export default function AlumniDocRequests() {
  const { alumniProfile } = useAlumniAuth();
  const [requests, setRequests] = useState<DocRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<DocRequestType | null>(null);
  const [purpose, setPurpose] = useState<RequestPurpose>("job_application");
  const [purposeDetails, setPurposeDetails] = useState("");
  const [urgency, setUrgency] = useState<RequestUrgency>("standard");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [viewDocUrl, setViewDocUrl] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!alumniProfile) return;
    try {
      const data = await queryDocuments<DocRequest>("docRequests", [
        where("alumniId", "==", alumniProfile.id),
        where("companyId", "==", alumniProfile.companyId),
        orderBy("createdAt", "desc"),
      ]);
      setRequests(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [alumniProfile]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const pendingByType = (type: DocRequestType) =>
    requests.some((r) => r.type === type && r.status === "pending");

  function openForm(type: DocRequestType) {
    setSelectedType(type);
    setPurpose("job_application");
    setPurposeDetails("");
    setUrgency("standard");
    setSuccessMessage(null);
  }

  function cancelForm() {
    setSelectedType(null);
    setSuccessMessage(null);
  }

  async function handleSubmit() {
    if (!alumniProfile || !selectedType) return;
    setSubmitting(true);
    try {
      const requestId = crypto.randomUUID();
      await setDocument("docRequests", requestId, {
        id: requestId,
        companyId: alumniProfile.companyId,
        alumniId: alumniProfile.id,
        alumniName: alumniProfile.name,
        alumniEmail: alumniProfile.email,
        type: selectedType,
        purpose,
        purposeDetails,
        urgency,
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

      const timeLabel =
        urgency === "urgent" ? "24 hours" : "3–5 business days";
      setSuccessMessage(
        `Request submitted! HR will review within ${timeLabel}.`
      );
      setSelectedType(null);
      await loadRequests();
    } catch {
      showToast("error", "Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!alumniProfile) return null;

  const companyName = (alumniProfile as unknown as { companyName?: string }).companyName ?? "your company";

  const DOC_TYPES: DocRequestType[] = ["reference_letter", "employment_verification"];

  return (
    <div className="space-y-8">
      {/* PDF Viewer Modal */}
      {viewDocUrl && (
        <Modal
          isOpen={true}
          onClose={() => setViewDocUrl(null)}
          title="Document Preview"
          size="lg"
        >
          <iframe
            src={viewDocUrl}
            className="w-full rounded-lg border border-navy/10"
            style={{ height: "70vh" }}
            title="Document Preview"
          />
        </Modal>
      )}

      {/* Header */}
      <div>
        <h1 className="font-display text-xl text-navy">Documents</h1>
        <p className="text-sm text-mist mt-0.5">
          Request reference letters and employment verification from {companyName}
        </p>
      </div>

      {successMessage && (
        <div className="bg-teal/5 border border-teal/20 rounded-xl px-4 py-3 text-sm text-teal flex items-center gap-2">
          <CheckCircle size={16} />
          {successMessage}
        </div>
      )}

      {/* New Request section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DOC_TYPES.map((type) => {
            const config = DOC_TYPE_CONFIG[type];
            const hasPending = pendingByType(type);
            const isSelected = selectedType === type;

            return (
              <div
                key={type}
                className={clsx(
                  "bg-white border rounded-xl p-5 transition-colors",
                  isSelected ? "border-teal" : "border-navy/10"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {type === "reference_letter" ? (
                      <FileText size={32} className="text-teal" />
                    ) : (
                      <BadgeCheck size={32} className="text-navy" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-navy">{config.label}</div>
                    <div className="text-xs text-mist mt-0.5">{config.description}</div>
                    <div className="mt-3">
                      {hasPending ? (
                        <p className="text-xs text-mist italic">
                          You already have a pending {config.label} request.
                        </p>
                      ) : (
                        <Button
                          size="sm"
                          variant={isSelected ? "primary" : "ghost"}
                          onClick={() => (isSelected ? cancelForm() : openForm(type))}
                        >
                          {isSelected ? "Cancel" : "Request"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Request form */}
        {selectedType && (
          <div className="bg-white border border-teal/20 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-navy">
              {DOC_TYPE_CONFIG[selectedType].label} — Request Form
            </h3>

            <div className="space-y-1">
              <label className="text-xs font-medium text-mist">Purpose</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as RequestPurpose)}
                className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 bg-white"
              >
                {(Object.entries(PURPOSE_LABELS) as [RequestPurpose, string][]).map(
                  ([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-mist">Details</label>
              <textarea
                rows={3}
                value={purposeDetails}
                onChange={(e) => setPurposeDetails(e.target.value)}
                placeholder={PURPOSE_PLACEHOLDERS[purpose]}
                className="w-full px-3 py-2 text-sm border border-navy/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-mist">Processing time</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="urgency"
                    value="standard"
                    checked={urgency === "standard"}
                    onChange={() => setUrgency("standard")}
                    className="mt-0.5 accent-teal"
                  />
                  <span className="text-sm text-navy">Standard (3–5 business days)</span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="urgency"
                    value="urgent"
                    checked={urgency === "urgent"}
                    onChange={() => setUrgency("urgent")}
                    className="mt-0.5 accent-teal"
                  />
                  <div>
                    <span className="text-sm text-navy">Urgent (within 24 hours)</span>
                    {urgency === "urgent" && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Urgent requests are processed as quickly as possible.
                      </p>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button onClick={handleSubmit} loading={submitting}>
                Submit Request
              </Button>
              <Button variant="ghost" onClick={cancelForm}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-navy">Your Requests</h2>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-teal" size={20} />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-sm text-mist text-center py-8">
            No document requests yet.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const config = DOC_TYPE_CONFIG[req.type];
              const statusConfig = STATUS_CONFIG[req.status];
              const createdDate = toDate(req.createdAt);
              const timelineStep = getTimelineStep(req.status);
              const showTimeline = req.status === "pending" || req.status === "approved";

              return (
                <div
                  key={req.id}
                  className="bg-white border border-navy/10 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {req.type === "reference_letter" ? (
                        <FileText size={18} className="text-teal flex-shrink-0" />
                      ) : (
                        <BadgeCheck size={18} className="text-navy flex-shrink-0" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-navy">{config.label}</div>
                        <div className="text-xs text-mist">
                          {PURPOSE_LABELS[req.purpose]}
                          {createdDate && (
                            <span className="ml-2">
                              · {formatDistanceToNow(createdDate, { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span
                      className={clsx(
                        "text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0",
                        statusConfig.color
                      )}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  {showTimeline && (
                    <div className="flex items-center gap-0">
                      {TIMELINE_STEPS.map((step, i) => {
                        const done = i <= timelineStep;
                        const current = i === timelineStep;
                        return (
                          <div key={step} className="flex items-center flex-1 last:flex-none">
                            <div className="flex flex-col items-center">
                              <div
                                className={clsx(
                                  "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0",
                                  current
                                    ? "bg-teal ring-2 ring-teal/30"
                                    : done
                                    ? "bg-teal"
                                    : "bg-navy/10"
                                )}
                              >
                                {done ? (
                                  <CheckCircle size={10} className="text-white" />
                                ) : (
                                  <Circle size={10} className="text-mist" />
                                )}
                              </div>
                              <span
                                className={clsx(
                                  "text-[10px] mt-1 text-center w-16",
                                  current ? "text-teal font-medium" : done ? "text-navy" : "text-mist"
                                )}
                              >
                                {step}
                              </span>
                            </div>
                            {i < TIMELINE_STEPS.length - 1 && (
                              <div
                                className={clsx(
                                  "flex-1 h-px mb-4",
                                  i < timelineStep ? "bg-teal" : "bg-navy/10"
                                )}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {req.status === "delivered" && req.documentUrl && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewDocUrl(req.documentUrl!)}
                      >
                        <Download size={13} className="mr-1" />
                        View Document
                      </Button>
                    </div>
                  )}

                  {req.status === "rejected" && req.rejectionReason && (
                    <p className="text-xs text-mist italic">
                      Reason: {req.rejectionReason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
