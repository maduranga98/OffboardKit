import type { Timestamp } from "firebase/firestore";

export type ThreadStatus = "open" | "answered" | "closed";

export interface KnowledgeThread {
  id: string;
  companyId: string;
  flowId: string;
  alumniId: string;
  alumniName: string;
  alumniEmail: string;
  knowledgeItemId: string | null;
  knowledgeItemTitle: string | null;
  subject: string;
  status: ThreadStatus;
  messageCount: number;
  lastMessageAt: Timestamp;
  lastMessageBy: "hr" | "alumni";
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface KnowledgeMessage {
  id: string;
  threadId: string;
  content: string;
  senderType: "hr" | "alumni";
  senderId: string;
  senderName: string;
  createdAt: Timestamp;
}
