import * as admin from "firebase-admin";

admin.initializeApp();

// Firestore triggers
export { onOffboardingCreated } from "./triggers/onOffboardingCreated";
export { onFlowApprovalChanged } from "./triggers/onFlowApprovalChanged";

// Firestore triggers
export { onKnowledgeItemUpdated } from "./triggers/onKnowledgeItemUpdated";
export { onAlumniOptedIn } from "./triggers/onAlumniOptedIn";

// Audit log triggers — record every state change in
// offboardFlows/{flowId}/auditLog for compliance reporting.
export {
  auditFlowCreated,
  auditFlowUpdated,
  auditTaskUpdated,
  auditExitInterviewSubmitted,
  auditKnowledgeItemAdded,
  auditAssetCreated,
  auditAssetUpdated,
} from "./triggers/auditLog";

// Scheduled functions
export { checkOverdueTasks } from "./triggers/onTaskOverdue";
export { expirePortals } from "./triggers/expirePortals";
export { checkGapEscalation } from "./triggers/gapEscalation";
export { sendKnowledgeReminders } from "./triggers/knowledgeReminder";
export { escalateUnackedNotifications } from "./triggers/escalateUnackedNotifications";
export { monthlyComplianceReport } from "./triggers/monthlyComplianceReport";
export { resetAnnualUsage } from "./triggers/resetAnnualUsage";

// Outbound HRIS / identity-provider webhooks
export {
  fireFlowWebhooks,
  fireAssetWebhooks,
} from "./triggers/fireIntegrationWebhooks";

// Callable functions
export { sendTeamInvite } from "./triggers/sendTeamInvite";
export { getCompanyMembers } from "./triggers/getCompanyMembers";

// AI Functions
export { analyzeSentiment } from "./ai/analyzeSentiment";
export { detectKnowledgeGaps } from "./ai/detectKnowledgeGaps";

// Analytics Functions
export { generateAnalyticsPdf } from "./analytics/generateAnalyticsPdf";
export { generateKnowledgePdf } from "./analytics/generateKnowledgePdf";

// Billing Functions
export { createCheckoutSession } from "./billing/createCheckoutSession";
export { stripeWebhook } from "./billing/stripeWebhook";
