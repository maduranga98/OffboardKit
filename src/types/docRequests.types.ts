import type { Timestamp } from "firebase/firestore";

export type DocRequestType = "reference_letter" | "employment_verification";
export type RequestPurpose = "job_application" | "visa" | "loan" | "rental" | "other";
export type RequestUrgency = "standard" | "urgent";
export type RequestStatus = "pending" | "approved" | "rejected" | "delivered";

export interface DocRequest {
  id: string;
  companyId: string;
  alumniId: string;
  alumniName: string;
  alumniEmail: string;
  type: DocRequestType;
  purpose: RequestPurpose;
  purposeDetails: string;
  urgency: RequestUrgency;
  status: RequestStatus;
  hrNotes: string;
  rejectionReason: string | null;
  documentUrl: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: Timestamp | null;
  deliveredAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastError?: string;
}

export const DOC_TYPE_CONFIG: Record<
  DocRequestType,
  { label: string; description: string; icon: string }
> = {
  reference_letter: {
    label: "Reference Letter",
    description: "A letter recommending the alumni for future employment",
    icon: "FileText",
  },
  employment_verification: {
    label: "Employment Verification",
    description: "Official confirmation of employment dates, role, and department",
    icon: "BadgeCheck",
  },
};

export const PURPOSE_LABELS: Record<RequestPurpose, string> = {
  job_application: "Job Application",
  visa: "Visa / Immigration",
  loan: "Loan / Mortgage",
  rental: "Rental Agreement",
  other: "Other",
};

export const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string }> = {
  pending: { label: "Pending HR Review", color: "bg-yellow-50 text-yellow-700" },
  approved: { label: "Approved", color: "bg-blue-50 text-blue-700" },
  rejected: { label: "Rejected", color: "bg-ember/10 text-ember" },
  delivered: { label: "Delivered", color: "bg-teal/10 text-teal" },
};
