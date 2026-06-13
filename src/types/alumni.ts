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
  hiddenJobIds?: string[];
  openToConsulting?: boolean;
  consultingSkills?: string[];
  engagementScore: number | null;
  engagementLevel: 'high' | 'medium' | 'low' | null;
  lastEngagementEventType: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type EngagementLevel = 'high' | 'medium' | 'low';

export const ENGAGEMENT_LEVEL_CONFIG: Record<EngagementLevel, {
  label: string;
  color: string;
  dot: string;
}> = {
  high:   { label: 'High',   color: 'bg-green-50 text-green-700',   dot: 'bg-green-500'  },
  medium: { label: 'Medium', color: 'bg-yellow-50 text-yellow-700', dot: 'bg-yellow-400' },
  low:    { label: 'Low',    color: 'bg-ember/10 text-ember',        dot: 'bg-ember'      },
};
