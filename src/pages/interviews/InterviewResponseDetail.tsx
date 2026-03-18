import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  MessageSquare,
  Star,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Briefcase,
  Building,
  Mail,
} from "lucide-react";
import { format } from "date-fns";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/shared/EmptyState";
import { getDocument } from "../../lib/firestore";
import type { ExitInterviewResponse } from "../../types/interview.types";

function RatingDisplay({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={18}
          className={
            star <= value ? "text-teal fill-teal" : "text-navy/20"
          }
        />
      ))}
      <span className="text-sm font-medium text-navy ml-2">{value}/5</span>
    </div>
  );
}

function YesNoDisplay({ value }: { value: string }) {
  const isYes = value.toLowerCase() === "yes";
  return (
    <div className="flex items-center gap-2">
      {isYes ? (
        <CheckCircle size={18} className="text-teal" />
      ) : (
        <XCircle size={18} className="text-ember" />
      )}
      <span className="text-sm font-medium text-navy">{isYes ? "Yes" : "No"}</span>
    </div>
  );
}

export default function InterviewResponseDetail() {
  const { id } = useParams<{ id: string }>();
  const [response, setResponse] = useState<ExitInterviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const doc = await getDocument<ExitInterviewResponse>(
          "exitInterviewResponses",
          id
        );
        setResponse(doc);
      } catch {
        // Error loading response
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <Card>
        <div className="py-12 text-center text-sm text-mist">Loading...</div>
      </Card>
    );
  }

  if (!response) {
    return (
      <Card>
        <EmptyState
          title="Response not found"
          description="This interview response may have been deleted or you don't have access."
          action={
            <Link to="/interviews">
              <Button variant="outline">
                <ArrowLeft size={16} className="mr-1.5" />
                Back to Interviews
              </Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const statusConfig: Record<string, { label: string; variant: "teal" | "ember" | "mist" | "amber" }> = {
    completed: { label: "Completed", variant: "teal" },
    in_progress: { label: "In Progress", variant: "amber" },
    pending: { label: "Pending", variant: "mist" },
    expired: { label: "Expired", variant: "ember" },
  };

  const status = statusConfig[response.status] || {
    label: response.status,
    variant: "mist" as const,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/interviews"
            className="p-2 rounded-md text-mist hover:text-navy hover:bg-navy/5 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-display text-navy">
              {response.employeeName}
            </h1>
            <p className="text-sm text-mist mt-0.5">
              Exit Interview Response · {response.templateName}
            </p>
          </div>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      {/* Employee Info */}
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <User size={16} className="text-mist" />
            <div>
              <p className="text-xs text-mist">Name</p>
              <p className="text-sm font-medium text-navy">
                {response.employeeName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-mist" />
            <div>
              <p className="text-xs text-mist">Role</p>
              <p className="text-sm font-medium text-navy">
                {response.employeeRole}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Building size={16} className="text-mist" />
            <div>
              <p className="text-xs text-mist">Department</p>
              <p className="text-sm font-medium text-navy">
                {response.employeeDepartment}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-mist" />
            <div>
              <p className="text-xs text-mist">Email</p>
              <p className="text-sm font-medium text-navy truncate">
                {response.employeeEmail}
              </p>
            </div>
          </div>
        </div>
        {response.submittedAt?.toDate && (
          <div className="mt-4 pt-4 border-t border-navy/5 flex items-center gap-2 text-sm text-mist">
            <Clock size={14} />
            Submitted on{" "}
            {format(response.submittedAt.toDate(), "MMMM d, yyyy 'at' h:mm a")}
          </div>
        )}
      </Card>

      {/* Responses */}
      {response.status === "completed" && response.responses.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-navy">
            Responses ({response.responses.length})
          </h2>
          {response.responses.map((qr, index) => (
            <Card key={qr.questionId}>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-medium text-mist bg-navy/5 rounded px-1.5 py-0.5 flex-shrink-0">
                    Q{index + 1}
                  </span>
                  <p className="text-sm font-medium text-navy">
                    {qr.questionText}
                  </p>
                </div>
                <div className="pl-7">
                  {qr.type === "rating" ? (
                    <RatingDisplay value={Number(qr.answer)} />
                  ) : qr.type === "yes_no" ? (
                    <YesNoDisplay value={String(qr.answer)} />
                  ) : (
                    <p className="text-sm text-navy/80 leading-relaxed">
                      {String(qr.answer) || (
                        <span className="text-mist italic">No answer provided</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<MessageSquare size={48} strokeWidth={1.5} />}
            title="Awaiting response"
            description="This employee hasn't completed their exit interview yet."
          />
        </Card>
      )}
    </div>
  );
}
