import type { Timestamp } from "firebase/firestore";

export type JobType = "full_time" | "part_time" | "contract" | "internship";
export type JobStatus = "open" | "closed" | "draft";
export type JobAudience = "all" | "department" | "rehire_only";
export type ApplicationStatus = "new" | "reviewed" | "shortlisted" | "rejected";
export type ApplicationType = "self" | "referral";

export interface AlumniJob {
  id: string;
  companyId: string;
  title: string;
  department: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  location: string;
  type: JobType;
  description: string;
  requirements: string;
  audience: JobAudience;
  audienceDepartment: string | null;
  applicationDeadline: Timestamp | null;
  status: JobStatus;
  applicationCount: number;
  referralCount: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AlumniApplication {
  id: string;
  companyId: string;
  jobId: string;
  jobTitle: string;
  type: ApplicationType;
  // self application fields
  alumniId?: string;
  alumniName?: string;
  alumniEmail?: string;
  coverNote?: string;
  linkedInUrl?: string;
  // referral fields
  referrerAlumniId?: string;
  referrerAlumniName?: string;
  referrerAlumniEmail?: string;
  refereeName?: string;
  refereeEmail?: string;
  refereeRelationship?: string;
  referralNote?: string;
  // shared
  status: ApplicationStatus;
  hrNotes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  shortlisted: "Shortlisted",
  rejected: "Rejected",
};
