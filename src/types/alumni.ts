import type { Timestamp } from "firebase/firestore";

export type AlumniStatus = "active" | "do_not_contact" | "rehire_candidate";

export type RehirePriority = "high" | "medium" | "low" | "none";

export type BoomerangStage = "none" | "potential" | "contacted" | "interviewing" | "rehired";

export const BOOMERANG_STAGE_ORDER: BoomerangStage[] = [
  "potential",
  "contacted",
  "interviewing",
  "rehired",
];

export const BOOMERANG_STAGE_LABELS: Record<BoomerangStage, string> = {
  none: "Not in Pipeline",
  potential: "Potential",
  contacted: "Contacted",
  interviewing: "Interviewing",
  rehired: "Rehired",
};

export interface AlumniProfile {
  id: string;
  companyId: string;
  flowId?: string;
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
  authUid?: string;
  boomerangStage?: BoomerangStage;
  openToReturn?: boolean | null;
  lastActiveAlumniDate?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
