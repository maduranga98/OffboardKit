import * as admin from "firebase-admin";

admin.initializeApp();

// Firestore triggers
export { onOffboardingCreated } from "./triggers/onOffboardingCreated";

// Firestore triggers
export { onKnowledgeItemUpdated } from "./triggers/onKnowledgeItemUpdated";

// Audit log triggers — record every state change in
// offboardFlows/{flowId}/auditLog for compliance reporting.
export {
  auditFlowCreated,
  auditFlowUpdated,
  auditTaskUpdated,
  auditExitInterviewSubmitted,
  auditKnowledgeItemAdded,
} from "./triggers/auditLog";

// Scheduled functions
export { checkOverdueTasks } from "./triggers/onTaskOverdue";
export { expirePortals } from "./triggers/expirePortals";
export { checkGapEscalation } from "./triggers/gapEscalation";
export { sendKnowledgeReminders } from "./triggers/knowledgeReminder";

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
