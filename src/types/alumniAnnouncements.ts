import type { Timestamp } from "firebase/firestore";

export interface AlumniAnnouncement {
  id: string;
  companyId: string;
  type: "news" | "roles" | "milestone" | "event";
  title: string;
  content: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  eventDate: Timestamp | null;
  eventLocation: string | null;
  audience: "all" | "opted_in_only";
  status: "draft" | "published";
  readCount: number;
  publishedAt: Timestamp | null;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AlumniAnnouncementRead {
  id: string;
  companyId: string;
  alumniId: string;
  announcementId: string;
  readAt: Timestamp;
}

export const ANNOUNCEMENT_TYPE_CONFIG = {
  news:      { label: "Company News", icon: "Megaphone", color: "bg-blue-50 text-blue-700" },
  roles:     { label: "Open Roles",   icon: "Briefcase", color: "bg-teal/10 text-teal" },
  milestone: { label: "Milestone",    icon: "Trophy",    color: "bg-yellow-50 text-yellow-700" },
  event:     { label: "Event",        icon: "Calendar",  color: "bg-purple-50 text-purple-700" },
} as const;
