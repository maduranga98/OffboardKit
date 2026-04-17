import { useState, useEffect } from "react";
import {
  MessageSquare,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Star,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { where, orderBy } from "firebase/firestore";
import clsx from "clsx";

import type { ExitInterviewResponse } from "../../types/interview.types";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { EmptyState } from "../../components/shared/EmptyState";
import { useAuth } from "../../hooks/useAuth";
import { queryDocuments } from "../../lib/firestore";

interface ExpandedState {
  [responseId: string]: boolean;
}

interface AnswersExpandedState {
  [responseId: string]: boolean;
}

export default function Interviews() {
  const { companyId } = useAuth();
  const [responses, setResponses] = useState<ExitInterviewResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedState, setExpandedState] = useState<ExpandedState>({});
  const [answersExpandedState, setAnswersExpandedState] = useState<AnswersExpandedState>({});

  useEffect(() => {
    if (!companyId) return;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const data = await queryDocuments<ExitInterviewResponse>(
          "exitInterviewResponses",
          [where("companyId", "==", companyId), orderBy("submittedAt", "desc")]
        );
        setResponses(data ?? []);
      } catch (err) {
        setError("Failed to load interview responses.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [companyId]);

  const toggleExpanded = (responseId: string) => {
    setExpandedState((prev) => ({
      ...prev,
      [responseId]: !prev[responseId],
    }));
  };

  const toggleAnswersExpanded = (responseId: string) => {
    setAnswersExpandedState((prev) => ({
      ...prev,
      [responseId]: !prev[responseId],
    }));
  };

  // Calculate stats
  const totalResponses = responses.length;
  const positiveCount = responses.filter(
    (r) => (r.sentimentLabel || r.sentiment) === "positive"
  ).length;
  const positivePercent =
    totalResponses > 0 ? Math.round((positiveCount / totalResponses) * 100) : 0;

  const riskFlagCount = responses.filter(
    (r) => r.riskFlags && r.riskFlags.length > 0
  ).length;

  const avgSentimentScore =
    responses.length > 0
      ? Math.round(
          (responses.reduce(
            (sum, r) => sum + ((r.sentimentScore ?? 0) + 1) * 50,
            0
          ) /
            responses.length) *
            100
        ) / 100
      : 0;

  const sentimentAsPercentage = Math.round((avgSentimentScore + 1) * 50);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <EmptyState title="Something went wrong" description={error} />
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl text-navy">Exit Interviews</h1>
        <p className="text-sm text-mist mt-1">
          AI-powered insights from every departure
        </p>
      </div>

      {/* Stats Row */}
      {totalResponses > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Responses"
            value={totalResponses.toString()}
            icon={<MessageSquare className="h-5 w-5" />}
          />
          <StatCard
            label="Positive Sentiment"
            value={`${positivePercent}%`}
            icon={<CheckCircle className="h-5 w-5" />}
            variant="teal"
          />
          <StatCard
            label="Risk Flags"
            value={riskFlagCount.toString()}
            icon={<AlertCircle className="h-5 w-5" />}
            variant={riskFlagCount > 0 ? "ember" : "navy"}
          />
          <StatCard
            label="Avg Sentiment Score"
            value={`${sentimentAsPercentage}%`}
            icon={<Star className="h-5 w-5" />}
          />
        </div>
      )}

      {/* Responses List */}
      {totalResponses === 0 ? (
        <Card>
          <EmptyState
            icon={<MessageSquare className="h-10 w-10 text-mist" />}
            title="No interview responses yet"
            description="Exit interview responses and AI-powered insights will appear here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {responses.map((response) => {
            const isExpanded = expandedState[response.id];
            const showAnswers = answersExpandedState[response.id];
            const hasRiskFlags = response.riskFlags && response.riskFlags.length > 0;
            const sentimentColor =
              (response.sentimentLabel || response.sentiment) === "positive"
                ? "teal"
                : (response.sentimentLabel || response.sentiment) === "negative"
                  ? "ember"
                  : "mist";

            return (
              <Card
                key={response.id}
                padding="none"
                className={clsx(
                  "transition-all",
                  isExpanded && "ring-1 ring-teal/20"
                )}
              >
                {/* Collapsed Header */}
                <button
                  onClick={() => toggleExpanded(response.id)}
                  className="w-full px-6 py-4 hover:bg-navy/[0.02] transition-colors text-left flex items-start gap-4"
                >
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-display text-sm font-semibold text-navy">
                          {response.employeeName}
                        </p>
                        <p className="text-xs text-mist mt-0.5">
                          {response.employeeRole}
                          {response.employeeDepartment && ` · ${response.employeeDepartment}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge
                          variant={
                            sentimentColor === "positive"
                              ? "teal"
                              : sentimentColor === "negative"
                                ? "ember"
                                : "mist"
                          }
                        >
                          {(response.sentimentLabel || response.sentiment)
                            .charAt(0)
                            .toUpperCase() +
                            (response.sentimentLabel || response.sentiment).slice(1)}
                        </Badge>
                        <span className="text-xs text-mist whitespace-nowrap">
                          {response.submittedAt?.toDate
                            ? format(response.submittedAt.toDate(), "MMM d, yyyy")
                            : ""}
                        </span>
                      </div>
                    </div>

                    {/* Summary preview */}
                    {response.aiSummary && (
                      <p className="text-xs text-mist mt-2 line-clamp-1">
                        {response.aiSummary}
                      </p>
                    )}

                    {/* Risk flags pill (always visible) */}
                    {hasRiskFlags && (
                      <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-ember/10 text-ember text-xs font-medium">
                        <AlertCircle className="h-3 w-3" />
                        Risk flags detected
                      </div>
                    )}
                  </div>

                  {/* Chevron */}
                  <div className="flex-shrink-0 mt-1 text-mist">
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-navy/5 px-6 py-6 space-y-6">
                    {/* AI Analysis Pending */}
                    {!response.aiAnalyzedAt && (
                      <div className="text-center py-8 bg-navy/[0.02] rounded-lg border border-navy/10">
                        <p className="text-sm text-mist">
                          AI analysis pending...
                        </p>
                      </div>
                    )}

                    {/* Section A: AI Summary */}
                    {response.aiAnalyzedAt && (
                      <div>
                        <div className="rounded-lg p-4 bg-teal/5 border border-teal/10">
                          <h3 className="text-xs font-semibold text-navy uppercase tracking-wide mb-2">
                            AI Summary
                          </h3>
                          <p className="text-sm text-navy leading-relaxed">
                            {response.aiSummary ||
                              "No summary available"}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Section B: Key Themes */}
                    {response.aiAnalyzedAt && response.keyThemes &&
                      response.keyThemes.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-navy uppercase tracking-wide mb-3">
                          Key Themes
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {response.keyThemes.map((theme, idx) => (
                            <Badge key={idx} variant="teal">
                              {theme}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Section C: Risk Flags */}
                    {response.aiAnalyzedAt && hasRiskFlags && (
                      <div className="rounded-lg p-4 bg-ember/5 border border-ember/10">
                        <h3 className="text-xs font-semibold text-ember uppercase tracking-wide mb-3 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Risk Flags
                        </h3>
                        <ul className="space-y-2">
                          {response.riskFlags.map((flag, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-ember flex items-start gap-2"
                            >
                              <span className="flex-shrink-0 mt-1">•</span>
                              <span>{flag}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-ember/70 mt-3 italic">
                          HR review recommended
                        </p>
                      </div>
                    )}

                    {/* Section D: Recommended Actions */}
                    {response.aiAnalyzedAt &&
                      response.recommendedActions &&
                      response.recommendedActions.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-navy uppercase tracking-wide mb-3">
                          Recommended Actions
                        </h3>
                        <ol className="space-y-2">
                          {response.recommendedActions.map((action, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-navy flex items-start gap-3"
                            >
                              <span className="flex-shrink-0 font-semibold text-teal">
                                {idx + 1}
                              </span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Section E: Interview Answers */}
                    {response.answers && response.answers.length > 0 && (
                      <div className="border-t border-navy/5 pt-6">
                        <button
                          onClick={() => toggleAnswersExpanded(response.id)}
                          className="flex items-center gap-2 text-sm font-medium text-teal hover:text-teal-light transition-colors"
                        >
                          {showAnswers ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          View full responses
                        </button>

                        {showAnswers && (
                          <div className="mt-4 space-y-4">
                            {response.answers.map((answer, idx) => (
                              <div key={answer.questionId} className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <span className="text-xs font-medium text-mist bg-navy/5 rounded px-1.5 py-0.5 flex-shrink-0">
                                    Q{idx + 1}
                                  </span>
                                  <p className="text-xs text-mist">
                                    {answer.questionText}
                                  </p>
                                </div>
                                <div className="pl-7">
                                  <AnswerDisplay answer={answer} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  variant = "navy",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: "teal" | "navy" | "ember";
}) {
  const iconBg = {
    teal: "bg-teal/10 text-teal",
    navy: "bg-navy/10 text-navy",
    ember: "bg-ember/10 text-ember",
  };

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-mist">{label}</p>
          <p className="mt-1 text-3xl font-semibold text-navy">{value}</p>
        </div>
        <div className={clsx("flex h-10 w-10 items-center justify-center rounded-full", iconBg[variant])}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function AnswerDisplay({
  answer,
}: {
  answer: { type: string; value: string | number };
}) {
  if (answer.type === "rating") {
    const rating = Number(answer.value);
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            className={
              star <= rating
                ? "text-teal fill-teal"
                : "text-navy/20"
            }
          />
        ))}
        <span className="text-sm font-medium text-navy ml-2">
          {rating}/5
        </span>
      </div>
    );
  }

  if (answer.type === "yes_no") {
    const isYes = String(answer.value).toLowerCase() === "yes";
    return (
      <div className="flex items-center gap-2">
        {isYes ? (
          <CheckCircle size={16} className="text-teal" />
        ) : (
          <XCircle size={16} className="text-ember" />
        )}
        <span className="text-sm font-medium text-navy">
          {isYes ? "Yes" : "No"}
        </span>
      </div>
    );
  }

  if (answer.type === "multiple_choice") {
    return <Badge variant="navy">{String(answer.value)}</Badge>;
  }

  return (
    <p className="text-sm text-navy/80 leading-relaxed">
      {String(answer.value) || (
        <span className="text-mist italic">No answer provided</span>
      )}
    </p>
  );
}
