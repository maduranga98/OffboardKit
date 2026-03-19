import type { Timestamp } from "firebase/firestore";

export type AlumniStatus = "active" | "do_not_contact" | "rehire_candidate";

export type RehirePriority = "high" | "medium" | "low" | "none";

export interface AlumniProfile {
  id: string;
  companyId: string;
  flowId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  exitDate: Timestamp;
  exitType: string;
  linkedIn: string;
  currentCompany: string;
  currentRole: string;
  status: AlumniStatus;
  rehirePriority: RehirePriority;
  notes: string;
  tags: string[];
  optedIn: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
