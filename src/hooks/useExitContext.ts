import { useState, useEffect } from "react";
import type { Timestamp } from "firebase/firestore";
import { queryDocuments, where } from "../lib/firestore";
import type { ExitInterviewResponse } from "../types/interview.types";

interface ExitContextData {
  sentimentScore: number | null;
  sentimentLabel: "positive" | "neutral" | "negative" | null;
  keyThemes: string[];
  riskFlags: string[];
  aiSummary: string | null;
  wouldRehire: boolean | null;
  wouldRecommend: boolean | null;
  npsScore: number | null;
  primaryExitReason: string | null;
  submittedAt: Timestamp | null;
  hasData: boolean;
}

interface UseExitContextResult {
  data: ExitContextData | null;
  loading: boolean;
  error: string | null;
}

interface UseExitContextProps {
  flowId: string | undefined;
  companyId: string;
}

function findExitReason(answers: ExitInterviewResponse["answers"]): string | null {
  const reasonKeywords = ["reason", "leaving", "left", "why did", "departure"];
  const match = answers.find((a) => {
    const text = a.questionText.toLowerCase();
    return reasonKeywords.some((kw) => text.includes(kw));
  });
  if (!match) return null;
  const val = match.value;
  if (typeof val === "string" && val.trim()) return val.trim();
  return null;
}

export function useExitContext({ flowId, companyId }: UseExitContextProps): UseExitContextResult {
  const [data, setData] = useState<ExitContextData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!flowId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const results = await queryDocuments<ExitInterviewResponse>(
          "exitInterviewResponses",
          [
            where("flowId", "==", flowId),
            where("companyId", "==", companyId),
          ]
        );

        if (cancelled) return;

        if (results.length === 0) {
          setData({ hasData: false, sentimentScore: null, sentimentLabel: null, keyThemes: [], riskFlags: [], aiSummary: null, wouldRehire: null, wouldRecommend: null, npsScore: null, primaryExitReason: null, submittedAt: null });
          return;
        }

        const interview = results[0];
        const primaryExitReason = findExitReason(interview.answers);

        // Normalise sentimentScore: if in -1..1 range convert to 0-100
        let sentimentScore: number | null = interview.sentimentScore ?? null;
        if (sentimentScore !== null && sentimentScore >= -1 && sentimentScore <= 1) {
          sentimentScore = Math.round((sentimentScore + 1) * 50);
        }

        setData({
          sentimentScore,
          sentimentLabel: (interview.sentimentLabel ?? interview.sentiment ?? null) as ExitContextData["sentimentLabel"],
          keyThemes: interview.keyThemes ?? [],
          riskFlags: interview.riskFlags ?? [],
          aiSummary: interview.aiSummary ?? null,
          wouldRehire: null,
          wouldRecommend: null,
          npsScore: null,
          primaryExitReason,
          submittedAt: interview.submittedAt ?? null,
          hasData: true,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load exit context");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [flowId, companyId]);

  return { data, loading, error };
}
