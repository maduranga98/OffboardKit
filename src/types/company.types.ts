import type { Timestamp } from "firebase/firestore";

export type CompanyPlan = "free" | "starter" | "pro" | "enterprise";
export type CompanySize = "10-50" | "50-200" | "200-500" | "500+";

export interface CompanySettings {
  brandColor: string;
  logoUrl: string;
  portalDomain: string;
  defaultTemplate: string;
  notificationEmail: string;
  slackWebhookUrl: string;
}

export interface CompanyFeatures {
  knowledgeVideo: boolean;
  alumniPortal: boolean;
  aiGapDetection: boolean;
  apiAccess: boolean;
}

export interface Company {
  id: string;
  name: string;
  domain: string;
  size: CompanySize;
  employeeCount: number;
  industry: string;
  country: string;
  timezone: string;
  plan: CompanyPlan;
  stripeCustomerId: string;
  settings: CompanySettings;
  features: CompanyFeatures;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
