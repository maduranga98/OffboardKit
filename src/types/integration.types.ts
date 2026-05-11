import type { Timestamp } from "firebase/firestore";

export type IntegrationProvider =
  | "generic_webhook"
  | "okta"
  | "azure_ad"
  | "workday"
  | "bamboohr";

export type IntegrationEvent =
  | "flow_completed"
  | "flow_cancelled"
  | "approval_completed"
  | "asset_wiped";

export interface Integration {
  id: string;
  companyId: string;
  // Display label, e.g. "Okta production tenant".
  name: string;
  provider: IntegrationProvider;
  // POST target. For provider-specific integrations this is the
  // tenant URL; for generic_webhook it's any HTTPS endpoint.
  webhookUrl: string;
  // Optional shared secret signed into an X-OffboardKit-Signature
  // header (HMAC-SHA256 of the payload).
  secret: string;
  events: IntegrationEvent[];
  isActive: boolean;
  lastTriggeredAt: Timestamp | null;
  lastStatus: "success" | "error" | null;
  lastError: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
