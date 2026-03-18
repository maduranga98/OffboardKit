import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
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
  updateDocument,
  serverTimestamp,
} from "../../lib/firestore";
import type {
  ExitInterviewResponse,
  ExitInterviewTemplate,
  InterviewQuestion,
  QuestionResponse,
} from "../../types/interview.types";

function OffboardKitLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="6" fill="#0D9E8A" />
      <path d="M7 8h8v12H7V8z" stroke="white" strokeWidth="2" fill="none" />
      <path
        d="M15 12l4 2-4 2"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M19 14h3" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function ExitInterviewPortal() {
  const { token } = useParams<{ token: string }>();
  const [response, setResponse] = useState<ExitInterviewResponse | null>(null);
  const [template, setTemplate] = useState<ExitInterviewTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const responses = await queryDocuments<ExitInterviewResponse>(
          "exitInterviewResponses",
          [where("portalToken", "==", token), firestoreLimit(1)]
        );
        if (responses.length === 0) {
          setError("Interview not found or link has expired.");
          setLoading(false);
          return;
        }
        const resp = responses[0];
        setResponse(resp);

        if (resp.status === "completed") {
          setSubmitted(true);
          setLoading(false);
          return;
        }

        const templates = await queryDocuments<ExitInterviewTemplate>(
          "exitInterviewTemplates",
          [where("__name__", "==", resp.templateId), firestoreLimit(1)]
        );

        if (templates.length > 0) {
          setTemplate(templates[0]);
        }

        // Pre-fill existing answers
        if (resp.responses?.length > 0) {
          const existing: Record<string, string | number> = {};
          resp.responses.forEach((r) => {
            existing[r.questionId] = r.answer;
          });
          setAnswers(existing);
        }
      } catch {
        setError("Something went wrong loading the interview.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

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
    if (!response) return;
    setSubmitting(true);
    try {
      const questionResponses: QuestionResponse[] = questions.map((q) => ({
        questionId: q.id,
        questionText: q.text,
        type: q.type,
        answer: answers[q.id] ?? "",
      }));

      await updateDocument("exitInterviewResponses", response.id, {
        status: "completed",
        responses: questionResponses,
        submittedAt: serverTimestamp(),
      });

      setSubmitted(true);
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-warm/30 flex items-center justify-center">
        <div className="text-sm text-mist">Loading interview...</div>
      </div>
    );
  }

  // Error state
  if (error && !response) {
    return (
      <div className="min-h-screen bg-warm/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <EmptyState
            icon={<MessageSquare size={48} strokeWidth={1.5} />}
            title="Interview Unavailable"
            description={error}
          />
        </Card>
      </div>
    );
  }

  // Submitted state
  if (submitted) {
    return (
      <div className="min-h-screen bg-warm/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <div className="py-8 px-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-teal/10 flex items-center justify-center mb-6">
              <CheckCircle size={32} className="text-teal" />
            </div>
            <h2 className="text-xl font-display text-navy mb-2">
              Thank you for your feedback
            </h2>
            <p className="text-sm text-mist max-w-sm mx-auto">
              Your responses have been recorded. We appreciate you taking the time
              to share your experience with us.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // No template loaded
  if (!template || questions.length === 0) {
    return (
      <div className="min-h-screen bg-warm/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <EmptyState
            title="Interview not available"
            description="The interview template could not be loaded."
          />
        </Card>
      </div>
    );
  }

  const isLastQuestion = currentQuestion === totalQuestions - 1;

  return (
    <div className="min-h-screen bg-warm/30">
      {/* Top bar */}
      <div className="bg-white border-b border-navy/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <OffboardKitLogo />
            <span className="font-display text-navy text-lg">OffboardKit</span>
          </div>
          <span className="text-xs text-mist">
            {currentQuestion + 1} of {totalQuestions}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-navy/5 h-1">
        <div
          className="h-full bg-teal transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question */}
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <Card>
          <div className="space-y-6">
            <div>
              <span className="text-xs font-medium text-mist bg-navy/5 rounded px-2 py-1">
                Question {currentQuestion + 1} of {totalQuestions}
              </span>
              <h2 className="text-lg font-display text-navy mt-3">
                {question.text}
              </h2>
              {question.required && (
                <p className="text-xs text-ember mt-1">Required</p>
              )}
            </div>

            {/* Answer input based on type */}
            {question.type === "text" && (
              <textarea
                value={String(answers[question.id] ?? "")}
                onChange={(e) => handleAnswer(e.target.value)}
                placeholder="Type your answer here..."
                rows={4}
                className="block w-full rounded-md border border-navy/20 px-3 py-2 text-sm text-navy placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
              />
            )}

            {question.type === "rating" && (
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleAnswer(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      size={32}
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
            )}

            {question.type === "yes_no" && (
              <div className="flex gap-3">
                {["Yes", "No"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    className={clsx(
                      "flex-1 py-3 rounded-md border text-sm font-medium transition-colors",
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

            {question.type === "multiple_choice" && question.options && (
              <div className="space-y-2">
                {question.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleAnswer(option)}
                    className={clsx(
                      "block w-full text-left px-4 py-3 rounded-md border text-sm transition-colors",
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
    </div>
  );
}
