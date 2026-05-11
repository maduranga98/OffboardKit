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
  dependsOnTaskId?: string;
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
  knowledgeGapAnalysis?: {
    completenessScore: number;
    gaps: {
      area: string;
      severity: "critical" | "high" | "medium" | "low";
      description: string;
      suggestedPrompt: string;
    }[];
    strengths: string[];
    overallAssessment: string;
    analyzedAt: Timestamp;
  };
}

export type AuditAction =
  | "flow_created"
  | "flow_status_changed"
  | "flow_cancelled"
  | "flow_completed"
  | "portal_accessed"
  | "task_status_changed"
  | "exit_interview_submitted"
  | "knowledge_item_added";

export interface AuditLogEntry {
  id: string;
  flowId: string;
  companyId: string;
  action: AuditAction;
  actorType: "user" | "portal" | "system";
  actorId: string | null;
  actorName: string | null;
  summary: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  metadata?: Record<string, unknown>;
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
  dependsOnTaskId?: string;
}
