import type { Timestamp } from "firebase/firestore";

export type KnowledgeItemType =
  | "process"
  | "contact"
  | "document"
  | "credential_handover"
  | "video_link"
  | "note";

export type KnowledgeItemStatus = "draft" | "submitted" | "reviewed";

export interface KnowledgeItem {
  id: string;
  companyId: string;
  flowId: string;
  employeeName: string;
  employeeDepartment: string;
  title: string;
  description: string;
  type: KnowledgeItemType;
  url: string;
  successor: string;
  status: KnowledgeItemStatus;
  submittedBy: string;
  reviewedBy: string;
  reviewedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
