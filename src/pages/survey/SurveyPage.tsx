import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, setDoc, serverTimestamp as fbServerTimestamp, collection } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  queryDocuments,
  updateDocument,
  serverTimestamp,
  where,
} from "../../lib/firestore";
import type { PulseSurvey, PulseResponse, QuestionType } from "../../types/pulseSurveys.types";

type PageState = "loading" | "invalid" | "already_submitted" | "survey" | "thankyou";

export default function SurveyPage() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [response, setResponse] = useState<PulseResponse | null>(null);
  const [survey, setSurvey] = useState<PulseSurvey | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setPageState("invalid"); return; }

    async function load() {
      try {
        const responses = await queryDocuments<PulseResponse>("pulseResponses", [
          where("token", "==", token),
        ]);
        if (responses.length === 0) { setPageState("invalid"); return; }
        const resp = responses[0];
        setResponse(resp);

        if (resp.status === "completed") { setPageState("already_submitted"); return; }

        const surveys = await queryDocuments<PulseSurvey>("pulseSurveys", [
          where("id", "==", resp.surveyId),
        ]);
        if (surveys.length === 0) { setPageState("invalid"); return; }
        setSurvey(surveys[0]);
        setPageState("survey");
      } catch {
        setPageState("invalid");
      }
    }
    load();
  }, [token]);

  const questions = survey
    ? [...survey.questions].sort((a, b) => a.order - b.order)
    : [];
  const currentQuestion = questions[step] ?? null;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const isLast = step === questions.length - 1;
  const progress = questions.length > 0 ? ((step + 1) / questions.length) * 100 : 0;

  function selectAnswer(value: number | string) {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
  }

  async function handleNext() {
    if (isLast) {
      await handleSubmit();
    } else {
      setStep((s) => s + 1);
    }
  }

  async function handleSubmit() {
    if (!response || !survey) return;
    setSubmitting(true);
    try {
      // Extract special fields
      let satisfactionScore: number | null = null;
      let wouldReturn: "yes" | "maybe" | "no" | null = null;
      let wouldRefer: boolean | null = null;

      for (const q of questions) {
        const ans = answers[q.id];
        if (q.type === "scale_1_5" && typeof ans === "number") {
          satisfactionScore = ans;
        }
        if (q.type === "yes_maybe_no" && (ans === "yes" || ans === "maybe" || ans === "no")) {
          wouldReturn = ans as "yes" | "maybe" | "no";
        }
        if (q.type === "yes_no") {
          wouldRefer = ans === "yes";
        }
      }

      await updateDocument("pulseResponses", response.id, {
        status: "completed",
        completedAt: serverTimestamp(),
        responses: answers,
        satisfactionScore,
        wouldReturn,
        wouldRefer,
        updatedAt: serverTimestamp(),
      });

      await updateDocument("pulseSurveys", survey.id, {
        totalResponded: (survey.totalResponded || 0) + 1,
        updatedAt: serverTimestamp(),
      });

      const engLogId = crypto.randomUUID();
      setDoc(doc(collection(db, 'alumniEngagementLog'), engLogId), {
        id: engLogId,
        companyId: response.companyId,
        alumniId: response.alumniId,
        eventType: 'survey_responded',
        metadata: { surveyId: response.surveyId },
        createdAt: fbServerTimestamp(),
      }).catch(console.error);

      setPageState("thankyou");
    } catch {
      // If update fails, show error state
    } finally {
      setSubmitting(false);
    }
  }

  // ── Layout wrapper ──────────────────────────────────────────────────────────
  const FONT = "font-sans";

  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-warm flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-teal border-t-transparent animate-spin" />
          <p className="text-sm text-mist">Loading survey…</p>
        </div>
      </div>
    );
  }

  if (pageState === "invalid") {
    return (
      <div className={`min-h-screen bg-warm flex flex-col items-center justify-center p-6 ${FONT}`}>
        <Logo />
        <h1 className="text-2xl font-display text-navy mt-6 mb-2">Link Invalid</h1>
        <p className="text-sm text-mist text-center max-w-sm">
          This survey link is invalid or has expired. Contact your former HR team for a new link.
        </p>
      </div>
    );
  }

  if (pageState === "already_submitted") {
    return (
      <div className={`min-h-screen bg-warm flex flex-col items-center justify-center p-6 ${FONT}`}>
        <Logo />
        <h1 className="text-2xl font-display text-teal mt-6 mb-2">Thank You!</h1>
        <p className="text-sm text-mist text-center max-w-sm">
          Your response has already been recorded. We appreciate your time.
        </p>
      </div>
    );
  }

  if (pageState === "thankyou") {
    return (
      <div className={`min-h-screen bg-warm flex flex-col items-center justify-center p-6 ${FONT}`}>
        <CheckAnimation />
        <h1 className="text-2xl font-display text-navy mt-6 mb-2">
          Thank you, {response?.alumniName?.split(" ")[0] ?? ""}!
        </h1>
        <p className="text-sm text-mist text-center max-w-sm">
          Your feedback has been recorded.{" "}
          {survey && `We appreciate you staying connected.`}
        </p>
        <Link
          to="/alumni-login"
          className="mt-6 text-xs text-teal hover:underline"
        >
          Log in to your alumni portal →
        </Link>
      </div>
    );
  }

  // Survey page
  return (
    <div className={`min-h-screen bg-warm flex flex-col ${FONT}`}>
      {/* Progress bar */}
      <div className="h-1 bg-navy/10">
        <div
          className="h-full bg-teal transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-navy/5">
        <Logo small />
        <span className="text-sm text-mist font-medium absolute left-1/2 -translate-x-1/2">
          Alumni Pulse Survey
        </span>
        <span className="text-xs text-mist">
          {step + 1} of {questions.length}
        </span>
      </header>

      {/* Question */}
      <div className="flex-1 flex items-center justify-center p-6">
        {currentQuestion && (
          <div className="max-w-lg w-full mx-auto space-y-8">
            <h2 className="text-xl font-display text-navy text-center leading-snug">
              {currentQuestion.text}
            </h2>

            <div className="flex justify-center">
              <AnswerInput
                type={currentQuestion.type}
                value={currentAnswer}
                onChange={selectAnswer}
              />
            </div>

            {currentAnswer !== undefined && (
              <div className="flex justify-center">
                <button
                  onClick={handleNext}
                  disabled={submitting}
                  className="px-8 py-3 bg-teal text-white text-sm font-semibold rounded-xl hover:bg-teal/90 transition-colors disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : isLast ? "Submit" : "Next"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Logo({ small }: { small?: boolean }) {
  return (
    <div className={small ? "text-base font-bold text-navy" : "text-2xl font-bold text-navy"}>
      Offboard<span className="text-teal">Kit</span>
    </div>
  );
}

function CheckAnimation() {
  return (
    <div className="relative flex items-center justify-center">
      <style>{`
        @keyframes checkDraw { to { stroke-dashoffset: 0; } }
        @keyframes circlePop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .check-circle { animation: circlePop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .check-path { stroke-dasharray: 50; stroke-dashoffset: 50; animation: checkDraw 0.4s 0.3s ease forwards; }
      `}</style>
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <circle className="check-circle" cx="40" cy="40" r="38" fill="#0D9E8A" opacity="0.15" />
        <circle cx="40" cy="40" r="30" fill="#0D9E8A" opacity="0.2" className="check-circle" style={{ animationDelay: "0.05s" }} />
        <path
          className="check-path"
          d="M26 41 L36 51 L54 31"
          stroke="#0D9E8A"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

interface AnswerInputProps {
  type: QuestionType;
  value: number | string | undefined;
  onChange: (v: number | string) => void;
}

function AnswerInput({ type, value, onChange }: AnswerInputProps) {
  if (type === "scale_1_5") {
    return (
      <div className="space-y-3">
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={`w-12 h-12 rounded-full text-sm font-semibold transition-all border-2 ${
                value === n
                  ? "bg-teal text-white border-teal"
                  : "bg-white text-navy border-navy/20 hover:border-teal/50"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-mist px-1">
          <span>1 = Not great</span>
          <span>5 = Excellent</span>
        </div>
      </div>
    );
  }

  if (type === "yes_no") {
    return (
      <div className="flex gap-3">
        {["yes", "no"].map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-8 py-3 rounded-xl text-sm font-semibold border-2 transition-all capitalize ${
              value === opt
                ? "bg-teal text-white border-teal"
                : "bg-white text-navy border-navy/20 hover:border-teal/50"
            }`}
          >
            {opt === "yes" ? "Yes" : "No"}
          </button>
        ))}
      </div>
    );
  }

  // yes_maybe_no
  return (
    <div className="flex gap-3 flex-wrap justify-center">
      {["yes", "maybe", "no"].map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-8 py-3 rounded-xl text-sm font-semibold border-2 transition-all capitalize ${
            value === opt
              ? "bg-teal text-white border-teal"
              : "bg-white text-navy border-navy/20 hover:border-teal/50"
          }`}
        >
          {opt.charAt(0).toUpperCase() + opt.slice(1)}
        </button>
      ))}
    </div>
  );
}
