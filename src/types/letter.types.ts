export type LetterType =
  | "reference"
  | "experience"
  | "employment_verification";

export interface LetterTemplate {
  id: string;
  companyId: string;
  name: string;
  type: LetterType;
  subject: string;
  body: string;
  closing: string;
  isDefault: boolean;
  createdAt: import("firebase/firestore").Timestamp;
  updatedAt: import("firebase/firestore").Timestamp;
}

export interface GenerateLetterPayload {
  templateId: string;
  alumniId: string;
  companyId: string;
  letterDate: string;
  recipientLine: string;
  customSubject: string;
  customBody: string;
  customClosing: string;
}
