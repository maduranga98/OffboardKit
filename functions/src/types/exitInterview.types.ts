/**
 * Shared shapes for the AI exit-interview question generator.
 *
 * Mirrored verbatim in src/types/exitInterview.types.ts — the callable's
 * request/response cross that boundary, so the two files must stay in step.
 */

export type Seniority = "junior" | "mid" | "senior" | "lead" | "exec";

export const SENIORITIES: readonly Seniority[] = [
  "junior",
  "mid",
  "senior",
  "lead",
  "exec",
] as const;

export type QuestionCategory =
  | "culture"
  | "management"
  | "compensation"
  | "growth"
  | "workload"
  | "tools"
  | "reason-for-leaving"
  | "other";

export const QUESTION_CATEGORIES: readonly QuestionCategory[] = [
  "culture",
  "management",
  "compensation",
  "growth",
  "workload",
  "tools",
  "reason-for-leaving",
  "other",
] as const;

export interface GeneratedQuestion {
  id: string;
  text: string;
  category: QuestionCategory;
  source: "ai" | "manual";
  order: number;
}

export interface GenerateExitQuestionsRequest {
  role: string;
  department: string;
  seniority: Seniority;
}

export interface GenerateExitQuestionsResponse {
  questions: GeneratedQuestion[];
  fromCache: boolean;
}

/**
 * Cache document id: `${seniority}_${department}_${role}`, lowercased with
 * every run of non-alphanumerics folded to a single '-'. Deterministic and
 * legible in the Firestore console, so no hashing.
 */
export function buildCacheKey(
  role: string,
  department: string,
  seniority: string
): string {
  return `${seniority}_${department}_${role}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
