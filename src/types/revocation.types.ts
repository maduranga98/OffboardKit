import type { Timestamp } from "firebase/firestore";

export interface SystemCatalogItem {
  id: string;
  companyId: string;
  name: string;
  isActive: boolean;
  isCustom?: boolean;
  createdAt: Timestamp;
}

export type RevocationStatus = "pending" | "revoked" | "not_applicable";

export interface AccessRevocation {
  id: string;
  flowId: string;
  companyId: string;
  toolName: string;
  status: RevocationStatus;
  revokedAt: Timestamp | null;
  revokedBy: string;
  revokedByName: string;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
