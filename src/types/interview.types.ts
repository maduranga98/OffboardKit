import type { Timestamp } from "firebase/firestore";

export type QuestionType = "text" | "rating" | "multiple_choice" | "yes_no";
export type Sentiment = "positive" | "neutral" | "negative";

export interface InterviewQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  required: boolean;
  order: number;
}

export interface ExitInterviewTemplate {
  id: string;
  companyId: string;
  name: string;
  description: string;
  isDefault: boolean;
  questions: InterviewQuestion[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InterviewAnswer {
  questionId: string;
  questionText: string;
  type: QuestionType;
  value: string | number;
}

export interface ExitInterviewResponse {
  id: string;
  companyId: string;
  flowId: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeRole: string;
  employeeDepartment: string;
  templateId: string;
  answers: InterviewAnswer[];
  sentiment: Sentiment;
  submittedAt: Timestamp;
  createdAt: Timestamp;
}
