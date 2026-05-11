import { useState } from "react";
import { CheckCircle, XCircle, Clock, Circle, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { updateDocument, serverTimestamp } from "../../lib/firestore";
import { showToast } from "../ui/Toast";
import type {
  OffboardFlow,
  ApprovalStep,
  ApprovalStepStatus,
} from "../../types/offboarding.types";

interface Props {
  flow: OffboardFlow;
  currentUserId: string | undefined;
  onUpdated: (next: Partial<OffboardFlow>) => void;
}

function stepIcon(status: ApprovalStepStatus) {
  switch (status) {
    case "approved":
      return <CheckCircle size={18} className="text-teal" />;
    case "rejected":
      return <XCircle size={18} className="text-ember" />;
    case "pending":
      return <Clock size={18} className="text-amber" />;
    default:
      return <Circle size={18} className="text-mist" />;
  }
}

function stepBadge(status: ApprovalStepStatus) {
  const map: Record<
    ApprovalStepStatus,
    { label: string; variant: "teal" | "ember" | "amber" | "mist" }
  > = {
    waiting: { label: "Waiting", variant: "mist" },
    pending: { label: "Action required", variant: "amber" },
    approved: { label: "Approved", variant: "teal" },
    rejected: { label: "Rejected", variant: "ember" },
  };
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export default function ApprovalPanel({ flow, currentUserId, onUpdated }: Props) {
  const steps = flow.approvalSteps ?? [];
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (steps.length === 0 || flow.approvalStatus === "not_required") {
    return null;
  }

  const currentIndex = flow.currentApproverIndex ?? -1;
  const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;
  const isMyTurn =
    !!currentStep &&
    currentStep.status === "pending" &&
    currentStep.approverId === currentUserId &&
    flow.approvalStatus === "pending";

  const decide = async (decision: "approved" | "rejected") => {
    if (!currentStep || currentIndex < 0) return;
    setSubmitting(true);
    try {
      const decidedAt = Timestamp.now();
      const updatedSteps: ApprovalStep[] = steps.map((s, i) =>
        i === currentIndex
          ? {
              ...s,
              status: decision,
              decidedAt,
              note: note.trim(),
            }
          : s
      );

      let patch: Partial<OffboardFlow> = {
        approvalSteps: updatedSteps,
      };

      if (decision === "rejected") {
        patch = {
          ...patch,
          approvalStatus: "rejected",
          status: "rejected",
          currentApproverIndex: currentIndex,
        };
      } else {
        const nextIndex = currentIndex + 1;
        if (nextIndex >= steps.length) {
          // Last approver — flow advances to not_started so the existing
          // approval trigger can send the portal email.
          patch = {
            ...patch,
            approvalStatus: "approved",
            status: "not_started",
            currentApproverIndex: -1,
          };
        } else {
          // Move to the next approver. Promote their step to "pending".
          patch.approvalSteps = updatedSteps.map((s, i) =>
            i === nextIndex ? { ...s, status: "pending" } : s
          );
          patch = {
            ...patch,
            currentApproverIndex: nextIndex,
          };
        }
      }

      await updateDocument("offboardFlows", flow.id, {
        ...patch,
        lastUpdatedBy: currentUserId ?? null,
        updatedAt: serverTimestamp(),
      });
      onUpdated(patch);
      setNote("");
      showToast(
        "success",
        decision === "approved" ? "Approval recorded" : "Request rejected"
      );
    } catch (err) {
      console.error("Approval decision failed", err);
      showToast("error", "Failed to record decision");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h2 className="text-base font-semibold text-navy">Approval Chain</h2>
        {flow.approvalStatus === "approved" && (
          <Badge variant="teal">All approved</Badge>
        )}
        {flow.approvalStatus === "rejected" && (
          <Badge variant="ember">Rejected</Badge>
        )}
        {flow.approvalStatus === "pending" && (
          <Badge variant="amber">Awaiting approval</Badge>
        )}
      </div>

      <ol className="space-y-3">
        {steps.map((s, i) => {
          const decided = s.decidedAt?.toDate?.();
          return (
            <li
              key={`${s.approverId}-${i}`}
              className="flex items-start gap-3 rounded-md border border-navy/5 px-3 py-3"
            >
              <div className="mt-0.5">{stepIcon(s.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-mist">
                    Step {i + 1}
                  </span>
                  <span className="text-sm font-medium text-navy truncate">
                    {s.approverName}
                  </span>
                  {stepBadge(s.status)}
                </div>
                <p className="text-xs text-mist mt-0.5 truncate">
                  {s.approverEmail}
                </p>
                {decided && (
                  <p className="text-xs text-mist mt-1">
                    {format(decided, "MMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
                {s.note && (
                  <p className="text-sm text-navy/80 mt-1 italic">"{s.note}"</p>
                )}
              </div>
              {i < steps.length - 1 && (
                <ArrowRight size={14} className="text-mist mt-1.5" />
              )}
            </li>
          );
        })}
      </ol>

      {isMyTurn && (
        <div className="mt-4 rounded-md border border-teal/30 bg-teal/5 p-3 space-y-3">
          <p className="text-sm font-medium text-navy">
            Your approval is required.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note (visible to HR and other approvers)"
            rows={2}
            className="block w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => decide("approved")}
              loading={submitting}
              disabled={submitting}
            >
              <CheckCircle size={14} className="mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => decide("rejected")}
              disabled={submitting}
            >
              <XCircle size={14} className="mr-1" />
              Reject
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
