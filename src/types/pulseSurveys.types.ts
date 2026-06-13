import type { Timestamp } from "firebase/firestore";

export type QuestionType = "scale_1_5" | "yes_no" | "yes_maybe_no";

export interface PulseSurveyQuestion {
  id: string;
  text: string;
  type: QuestionType;
  order: number;
}

export interface PulseSurvey {
  id: string;
  companyId: string;
  name: string;
  isActive: boolean;
  questions: PulseSurveyQuestion[];
  schedule: "manual" | "quarterly" | "biannual" | "monthly";
  lastSentAt: Timestamp | null;
  nextSendAt: Timestamp | null;
  totalSent: number;
  totalResponded: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PulseResponse {
  id: string;
  companyId: string;
  surveyId: string;
  alumniId: string;
  alumniName: string;
  alumniEmail: string;
  token: string;
  status: "sent" | "completed";
  sentAt: Timestamp;
  completedAt: Timestamp | null;
  responses: Record<string, number | string>;
  satisfactionScore: number | null;
  wouldReturn: "yes" | "maybe" | "no" | null;
  wouldRefer: boolean | null;
}

export const DEFAULT_SURVEY_QUESTIONS: Omit<PulseSurveyQuestion, "id">[] = [
  { text: "How's your current role going?", type: "scale_1_5", order: 1 },
  { text: "Would you consider returning to [Company]?", type: "yes_maybe_no", order: 2 },
  { text: "Would you refer someone to work at [Company]?", type: "yes_no", order: 3 },
];
