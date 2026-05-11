import type { Timestamp } from "firebase/firestore";

export type AssetCondition = "good" | "fair" | "damaged" | "missing";

// Status drives the return-verification workflow:
//   assigned       — given to employee, not yet returned
//   returned       — employee says it's back; IT has not verified
//   verified       — IT has physically inspected and accepted the asset
//   wiped          — data sanitization complete (laptops, phones, tablets)
// `missing` and `damaged` are condition values, not statuses; a verified
// asset can still have damaged condition.
export type AssetStatus = "assigned" | "returned" | "verified" | "wiped";

export type AssetWipeStatus = "not_required" | "pending" | "completed";

export interface Asset {
  id: string;
  companyId: string;
  flowId: string;
  name: string;
  type: string;
  serialNumber: string;
  condition: AssetCondition;
  notes: string;

  // Checkout / assignment
  assignedTo: string;
  assignedAt: Timestamp | null;
  estimatedValue: number | null;

  // Return + verification chain
  status: AssetStatus;
  returnedAt: Timestamp | null;
  returnedBy: string;
  verifiedAt: Timestamp | null;
  verifiedBy: string;

  // Data sanitization (only meaningful for devices that store data)
  wipeStatus: AssetWipeStatus;
  wipeCompletedAt: Timestamp | null;
  wipeCompletedBy: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const WIPE_REQUIRED_TYPES = ["Laptop", "Phone", "Tablet"];
