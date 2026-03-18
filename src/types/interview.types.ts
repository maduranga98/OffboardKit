import type { Timestamp } from "firebase/firestore";

export type InterviewStatus = "draft" | "active" | "archived";
export type ResponseStatus = "pending" | "in_progress" | "completed" | "expired";
export type QuestionType = "text" | "rating" | "multiple_choice" | "yes_no";

export interface InterviewQuestion {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  order: number;
}

export interface ExitInterviewTemplate {
  id: string;
  companyId: string;
  name: string;
  description: string;
  questions: InterviewQuestion[];
  status: InterviewStatus;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface QuestionResponse {
  questionId: string;
  questionText: string;
  type: QuestionType;
  answer: string | number;
}

export interface ExitInterviewResponse {
  id: string;
  companyId: string;
  templateId: string;
  templateName: string;
  flowId: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeDepartment: string;
  employeeRole: string;
  status: ResponseStatus;
  responses: QuestionResponse[];
  submittedAt: Timestamp | null;
  createdAt: Timestamp;
  portalToken: string;
}
