import * as admin from "firebase-admin";

admin.initializeApp();

// Firestore triggers
export { onOffboardingCreated } from "./triggers/onOffboardingCreated";
export { onFlowApprovalChanged } from "./triggers/onFlowApprovalChanged";
export { onAlumniRehirePriorityChange } from "./alumni/onRehirePriorityChange";
export { onAnnouncementPublished } from "./alumni/onAnnouncementPublished";
export { onExpertThreadCreated, onExpertThreadUpdated } from "./alumni/expertThreadNotifications";

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
export { sendPulseSurvey } from "./alumni/sendPulseSurvey";
export { sendTeamInvite } from "./triggers/sendTeamInvite";
export { sendAlumniInvite } from "./triggers/sendAlumniInvite";
export { getCompanyMembers } from "./triggers/getCompanyMembers";
export { testSlackWebhook } from "./triggers/testSlackWebhook";

// AI Functions
export { analyzeSentiment } from "./ai/analyzeSentiment";
export { detectKnowledgeGaps } from "./ai/detectKnowledgeGaps";

// Analytics Functions
export { generateAnalyticsPdf } from "./analytics/generateAnalyticsPdf";
export { generateKnowledgePdf } from "./analytics/generateKnowledgePdf";

// Billing Functions
export { createCheckoutSession } from "./billing/createCheckoutSession";
export { stripeWebhook } from "./billing/stripeWebhook";
