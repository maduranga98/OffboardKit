import { useState, useEffect } from "react";
import {
  MessageSquare,
  Star,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Send,
} from "lucide-react";
import clsx from "clsx";
import { where, limit as firestoreLimit } from "firebase/firestore";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/shared/EmptyState";
import {
  queryDocuments,
  setDocument,
  updateDocument,
  serverTimestamp,
} from "../../lib/firestore";
import type { OffboardFlow } from "../../types/offboarding.types";
import type {
  ExitInterviewTemplate,
  ExitInterviewResponse,
  InterviewQuestion,
  InterviewAnswer,
  Sentiment,
} from "../../types/interview.types";

const ratingLabels: Record<number, string> = {
  1: "Poor",
  2: "Below Average",
  3: "Average",
  4: "Good",
  5: "Excellent",
};

function calculateSentiment(
  answers: InterviewAnswer[],
  questions: InterviewQuestion[]
): Sentiment {
  const ratingAnswers = answers.filter((a) => {
    const q = questions.find((q) => q.id === a.questionId);
    return q?.type === "rating" && typeof a.value === "number";
  });

  if (ratingAnswers.length === 0) return "neutral";

  const avg =
    ratingAnswers.reduce((sum, a) => sum + Number(a.value), 0) /
    ratingAnswers.length;

  if (avg >= 4) return "positive";
  if (avg <= 2) return "negative";
  return "neutral";
}

interface ExitInterviewPortalProps {
  flow: OffboardFlow;
}

export default function ExitInterviewPortal({ flow }: ExitInterviewPortalProps) {
  const [template, setTemplate] = useState<ExitInterviewTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        // Check for existing response
        const existing = await queryDocuments<ExitInterviewResponse>(
          "exitInterviewResponses",
          [where("flowId", "==", flow.id), firestoreLimit(1)]
        );
        if (existing.length > 0) {
          setSubmitted(true);
          setLoading(false);
          return;
        }

        // Get default template for this company
        const templates = await queryDocuments<ExitInterviewTemplate>(
          "exitInterviewTemplates",
          [
            where("companyId", "==", flow.companyId),
            where("isDefault", "==", true),
            firestoreLimit(1),
          ]
        );

        if (templates.length > 0) {
          setTemplate(templates[0]);
        } else {
          // Fallback: get any template for this company
          const anyTemplates = await queryDocuments<ExitInterviewTemplate>(
            "exitInterviewTemplates",
            [
              where("companyId", "==", flow.companyId),
              firestoreLimit(1),
            ]
          );
          if (anyTemplates.length > 0) {
            setTemplate(anyTemplates[0]);
          }
        }
      } catch {
        setError("Something went wrong loading the interview.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [flow.id, flow.companyId]);

  const questions: InterviewQuestion[] = template?.questions || [];
  const question = questions[currentQuestion];
  const totalQuestions = questions.length;
  const progress =
    totalQuestions > 0
      ? Math.round(((currentQuestion + 1) / totalQuestions) * 100)
      : 0;

  const canProceed = () => {
    if (!question) return false;
    if (!question.required) return true;
    const answer = answers[question.id];
    return answer !== undefined && answer !== "";
  };

  const handleAnswer = (value: string | number) => {
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
  };

  const handleSubmit = async () => {
    if (!template) return;
    setSubmitting(true);
    setError("");
    try {
      const interviewAnswers: InterviewAnswer[] = questions.map((q) => ({
        questionId: q.id,
        questionText: q.text,
        type: q.type,
        value: answers[q.id] ?? "",
      }));

      const sentiment = calculateSentiment(interviewAnswers, questions);
      const responseId = crypto.randomUUID();

      await setDocument("exitInterviewResponses", responseId, {
        companyId: flow.companyId,
        flowId: flow.id,
        employeeId: flow.employeeId,
        employeeName: flow.employeeName,
        employeeEmail: flow.employeeEmail,
        employeeRole: flow.employeeRole,
        employeeDepartment: flow.employeeDepartment,
        templateId: template.id,
        answers: interviewAnswers,
        sentiment,
        submittedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      // Update flow completion scores
      await updateDocument("offboardFlows", flow.id, {
        "completionScores.exitInterview": 100,
      });

      setSubmitted(true);
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-mist">
        Loading interview...
      </div>
    );
  }

  // Already submitted
  if (submitted) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-teal/10 flex items-center justify-center mb-6">
          <CheckCircle size={32} className="text-teal" />
        </div>
        <h2 className="text-xl font-display text-navy mb-2">
          Thank you for your feedback
        </h2>
        <p className="text-sm text-mist max-w-sm mx-auto">
          Your responses have been recorded. We appreciate you taking the time to
          share your experience with us.
        </p>
      </div>
    );
  }

  // No template available
  if (!template || questions.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare size={48} strokeWidth={1.5} />}
        title="Interview not available"
        description="No exit interview template has been set up for your organization yet."
      />
    );
  }

  const isLastQuestion = currentQuestion === totalQuestions - 1;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-mist">
            Question {currentQuestion + 1} of {totalQuestions}
          </span>
          <span className="text-xs text-mist">{progress}%</span>
        </div>
        <div className="bg-navy/5 h-1.5 rounded-full">
          <div
            className="h-full bg-teal rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-display text-navy">{question.text}</h2>
            {question.required && (
              <p className="text-xs text-ember mt-1">Required</p>
            )}
          </div>

          {/* Text */}
          {question.type === "text" && (
            <textarea
              value={String(answers[question.id] ?? "")}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder="Type your answer here..."
              rows={4}
              className="block w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
            />
          )}

          {/* Rating */}
          {question.type === "rating" && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleAnswer(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      size={36}
                      className={clsx(
                        "transition-colors",
                        star <= (Number(answers[question.id]) || 0)
                          ? "text-teal fill-teal"
                          : "text-navy/20 hover:text-teal/50"
                      )}
                    />
                  </button>
                ))}
              </div>
              {answers[question.id] && (
                <p className="text-sm text-mist">
                  {ratingLabels[Number(answers[question.id])]}
                </p>
              )}
            </div>
          )}

          {/* Yes/No */}
          {question.type === "yes_no" && (
            <div className="flex gap-3">
              {["Yes", "No"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  className={clsx(
                    "flex-1 py-4 rounded-md border text-sm font-medium transition-colors",
                    answers[question.id] === opt
                      ? "border-teal bg-teal/10 text-teal"
                      : "border-navy/20 text-navy hover:border-teal/50"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Multiple choice */}
          {question.type === "multiple_choice" && question.options && (
            <div className="flex flex-wrap gap-2">
              {question.options.map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer(option)}
                  className={clsx(
                    "px-4 py-2 rounded-full border text-sm transition-colors",
                    answers[question.id] === option
                      ? "border-teal bg-teal/10 text-teal font-medium"
                      : "border-navy/20 text-navy hover:border-teal/50"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-navy/5">
            <Button
              variant="ghost"
              onClick={() => setCurrentQuestion((prev) => prev - 1)}
              disabled={currentQuestion === 0}
            >
              <ChevronLeft size={16} className="mr-1" />
              Back
            </Button>

            {isLastQuestion ? (
              <Button
                onClick={handleSubmit}
                loading={submitting}
                disabled={!canProceed()}
              >
                <Send size={16} className="mr-1.5" />
                Submit
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentQuestion((prev) => prev + 1)}
                disabled={!canProceed()}
              >
                Next
                <ChevronRight size={16} className="ml-1" />
              </Button>
            )}
          </div>

          {error && (
            <p className="text-sm text-ember text-center">{error}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
