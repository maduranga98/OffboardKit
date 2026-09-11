import type { Timestamp } from "firebase/firestore";

export type CompanyPlan = "basic" | "starter" | "growth" | "business" | "enterprise";
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

/**
 * Card-free Starter trial. Granted by claimCompany at signup and closed by
 * the expireTrials sweep; every field is server-owned (see firestore.rules).
 */
export type TrialStatus = "active" | "expired" | "converted";

export interface UsageCount {
  offboardingsThisYear: number;
  activeOffboardings: number;
}

export interface Company {
  id: string;
  /** UID of the user who created the company; verified by claimCompany. */
  ownerUid?: string;
  name: string;
  domain: string;
  size: CompanySize;
  employeeCount: number;
  industry: string;
  country: string;
  timezone: string;
  plan: CompanyPlan;
  // Stripe billing identifiers; populated by createCheckoutSession +
  // stripeWebhook. Optional because companies start on the basic plan.
  stripeCustomerId?: string;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string;
  // Trial state. Absent on companies created before trials existed, which
  // reads the same as "never had one".
  trialPlan?: CompanyPlan;
  trialStatus?: TrialStatus;
  trialStartedAt?: Timestamp;
  trialEndsAt?: Timestamp;
  billingCycle?: "monthly" | "annual";
  settings: CompanySettings;
  features: CompanyFeatures;
  usageCount?: UsageCount;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
