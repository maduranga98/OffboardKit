import * as admin from "firebase-admin";

admin.initializeApp();

// Firestore triggers
export { onOffboardingCreated } from "./triggers/onOffboardingCreated";
export { onFlowApprovalChanged } from "./triggers/onFlowApprovalChanged";
export { onAlumniRehirePriorityChange } from "./alumni/onRehirePriorityChange";
export { onAnnouncementPublished } from "./alumni/onAnnouncementPublished";
export { onGigRequestCreated, onGigRequestResponded } from "./alumni/gigNotifications";
export { onExpertThreadCreated, onExpertThreadUpdated } from "./alumni/expertThreadNotifications";

// Firestore triggers
export { onKnowledgeItemUpdated } from "./triggers/onKnowledgeItemUpdated";
export { onAlumniOptedIn } from "./triggers/onAlumniOptedIn";
export { syncAlumniDirectory, backfillAlumniDirectory } from "./alumni/syncAlumniDirectory";

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
export { expireTrials } from "./triggers/expireTrials";

// Usage counters — maintained server-side; firestore.rules bars clients from
// touching usageCount, since the Basic-plan cap is judged on it.
export {
  onFlowCreatedUpdateUsage,
  onFlowStatusChangedUpdateUsage,
} from "./triggers/usageCounters";

// Callable functions
export { redeemPortalToken, redeemSurveyToken } from "./portal/redeemPortalToken";
export { sendPulseSurvey } from "./alumni/sendPulseSurvey";
export { sendTeamInvite } from "./triggers/sendTeamInvite";
export { claimCompany, acceptInvite, setMemberRole, removeMember } from "./triggers/membership";
export { syncStaffClaims, refreshMyClaims } from "./triggers/staffClaims";
export { sendAlumniInvite } from "./triggers/sendAlumniInvite";
export { getCompanyMembers } from "./triggers/getCompanyMembers";

// AI Functions
export { analyzeSentiment } from "./ai/analyzeSentiment";
export { detectKnowledgeGaps } from "./ai/detectKnowledgeGaps";

// Analytics Functions
export { generateAnalyticsPdf } from "./analytics/generateAnalyticsPdf";
export { generateKnowledgePdf } from "./analytics/generateKnowledgePdf";

// Billing Functions
export { createCheckoutSession } from "./billing/createCheckoutSession";
export { createBillingPortalSession } from "./billing/createBillingPortalSession";
export { stripeWebhook } from "./billing/stripeWebhook";

// Document generation
export { generateDocument, onDocumentRejected } from "./alumni/generateDocument";

// Letter PDF generation
export { generateLetterPdf } from "./alumni/generateLetterPdf";

// Re-engagement score
export { onEngagementEventLogged } from "./alumni/reengagementScore";
