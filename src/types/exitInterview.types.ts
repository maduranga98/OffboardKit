import type { InterviewQuestion } from "./interview.types";

/**
 * Frontend mirror of functions/src/types/exitInterview.types.ts.
 * The generateExitQuestions callable's request/response cross that boundary,
 * so the two files must stay in step.
 */

export type Seniority = "junior" | "mid" | "senior" | "lead" | "exec";

export type QuestionCategory =
  | "culture"
  | "management"
  | "compensation"
  | "growth"
  | "workload"
  | "tools"
  | "reason-for-leaving"
  | "other";

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

export const SENIORITY_OPTIONS: { value: Seniority; label: string }[] = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
  { value: "exec", label: "Executive" },
];

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  culture: "Culture",
  management: "Management",
  compensation: "Compensation",
  growth: "Growth",
  workload: "Workload",
  tools: "Tools",
  "reason-for-leaving": "Reason for Leaving",
  other: "Other",
};

/**
 * Adapt a generated question to the shape the exit-interview template builder
 * stores. The generator only produces open-ended prompts, so every question
 * lands as a required free-text answer — HR can switch the type afterwards in
 * the builder like any hand-written question.
 *
 * The id is regenerated: cache ids are stable per role/department/seniority,
 * so pulling the same cached set into two templates (or twice into one) would
 * otherwise collide.
 */
export function toInterviewQuestion(
  question: GeneratedQuestion,
  order: number
): InterviewQuestion {
  return {
    id: crypto.randomUUID(),
    text: question.text,
    type: "text",
    required: true,
    order,
  };
}
