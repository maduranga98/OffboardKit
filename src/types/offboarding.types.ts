import type { Timestamp } from "firebase/firestore";

export type TaskType = "checkbox" | "upload" | "signature" | "form" | "link";
export type TaskStatus = "pending" | "in_progress" | "completed" | "overdue" | "skipped";
export type FlowStatus = "not_started" | "in_progress" | "completed" | "cancelled";

export interface TemplateTask {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  assigneeRole: string;
  dayOffset: number;
  isRequired: boolean;
  order: number;
}

export interface OffboardTemplate {
  id: string;
  companyId: string;
  name: string;
  description: string;
  targetRole: string;
  targetDepartment: string;
  isDefault: boolean;
  tasks: TemplateTask[];
  createdBy: string;
  createdAt: Timestamp;
}

export interface CompletionScores {
  tasks: number;
  knowledge: number;
  accessRevocation: number;
  exitInterview: number;
  assets: number;
}

export interface OffboardFlow {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeRole: string;
  employeeDepartment: string;
  managerId: string;
  templateId: string;
  status: FlowStatus;
  startDate: Timestamp;
  lastWorkingDay: Timestamp;
  completedAt: Timestamp | null;
  progressPercent: number;
  portalToken: string;
  completionScores: CompletionScores;
  createdAt: Timestamp;
}

export interface FlowTask {
  id: string;
  flowId: string;
  title: string;
  description: string;
  type: TaskType;
  assigneeId: string;
  assigneeRole: string;
  assigneeName: string;
  dueDate: Timestamp;
  status: TaskStatus;
  completedAt: Timestamp | null;
  completedBy: string;
  uploadedFileUrl: string;
  notes: string;
  isRequired: boolean;
}
