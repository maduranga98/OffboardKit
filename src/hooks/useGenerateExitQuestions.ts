import { useState, useCallback } from "react";
import { httpsCallable, type FunctionsError } from "firebase/functions";
import { functions } from "../lib/firebase";
import type {
  GenerateExitQuestionsRequest,
  GenerateExitQuestionsResponse,
} from "../types/exitInterview.types";

/**
 * Raw HttpsError messages are written for logs, not for HR. Map the codes the
 * callable actually throws onto something a person can act on, and keep the
 * subscription lock's own message (it names the fix) intact.
 */
function friendlyError(error: unknown): string {
  const { code, message } = (error ?? {}) as Partial<FunctionsError>;

  if (typeof message === "string" && message.startsWith("subscription-required:")) {
    return message.slice("subscription-required:".length).trim();
  }

  switch (code) {
    case "functions/unauthenticated":
    case "functions/permission-denied":
      return "You are not signed in to a company workspace.";
    case "functions/invalid-argument":
      return message || "Check the job title, department, and seniority.";
    case "functions/failed-precondition":
      return message || "Question generation is not configured yet.";
    case "functions/deadline-exceeded":
      return "Generation timed out. Please try again.";
    default:
      return "Failed to generate questions. Please try again.";
  }
}

export function useGenerateExitQuestions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (
      params: GenerateExitQuestionsRequest
    ): Promise<GenerateExitQuestionsResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const fn = httpsCallable<
          GenerateExitQuestionsRequest,
          GenerateExitQuestionsResponse
        >(functions, "generateExitQuestions");
        const result = await fn(params);
        return result.data;
      } catch (err) {
        console.error("generateExitQuestions failed:", err);
        setError(friendlyError(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => setError(null), []);

  return { generate, loading, error, reset };
}
