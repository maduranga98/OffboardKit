import type { Timestamp } from "firebase/firestore";

export interface Asset {
  id: string;
  companyId: string;
  flowId: string;
  name: string;
  type: string;
  serialNumber: string;
  condition: "good" | "fair" | "damaged" | "missing";
  notes: string;
  returnedAt: Timestamp | null;
  returnedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
