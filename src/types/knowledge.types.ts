import type { Timestamp } from "firebase/firestore";

export type KnowledgeItemType =
  | "process"
  | "contact"
  | "document"
  | "credential_handover"
  | "video_link"
  | "note";

export type KnowledgeItemStatus = "draft" | "submitted" | "reviewed";

export type GapSeverity = "critical" | "high" | "medium" | "low";

export type VerificationStatus = "pending" | "approved" | "rejected";

export interface VerificationHistory {
  status: VerificationStatus;
  verifiedBy: string;
  verifiedAt: Timestamp;
  notes?: string;
}

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
  hasGap: boolean;
  gapReason?: string;
  gapSeverity?: GapSeverity;
  managerVerified: boolean;
  managerVerificationStatus?: VerificationStatus;
  managerVerifiedBy?: string;
  managerVerifiedAt?: Timestamp | null;
  verificationHistory?: VerificationHistory[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
