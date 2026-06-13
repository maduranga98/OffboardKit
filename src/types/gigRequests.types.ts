import type { Timestamp } from "firebase/firestore";

export type GigStatus = "sent" | "accepted" | "declined" | "completed" | "cancelled";

export type EngagementType = "one_time" | "ongoing" | "advisory";

export interface GigRequest {
  id: string;
  companyId: string;
  alumniId: string;
  alumniName: string;
  alumniEmail: string;
  title: string;
  scope: string;
  requiredSkills: string[];
  timelineWeeks: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  engagementType: EngagementType;
  status: GigStatus;
  alumniNote: string | null;
  hrNotes: string;
  respondedAt: Timestamp | null;
  completedAt: Timestamp | null;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const GIG_STATUS_CONFIG: Record<GigStatus, { label: string; color: string }> = {
  sent:      { label: "Sent",      color: "bg-blue-50 text-blue-700" },
  accepted:  { label: "Accepted",  color: "bg-green-50 text-green-700" },
  declined:  { label: "Declined",  color: "bg-navy/5 text-mist" },
  completed: { label: "Completed", color: "bg-teal/10 text-teal" },
  cancelled: { label: "Cancelled", color: "bg-navy/5 text-mist" },
};

export const ENGAGEMENT_TYPE_LABELS: Record<EngagementType, string> = {
  one_time: "One-time Project",
  ongoing:  "Ongoing Engagement",
  advisory: "Advisory / Consulting",
};
