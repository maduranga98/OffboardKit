import * as admin from "firebase-admin";

admin.initializeApp();

// Firestore triggers
export { onOffboardingCreated } from "./triggers/onOffboardingCreated";

// Scheduled functions
export { checkOverdueTasks } from "./triggers/onTaskOverdue";
export { expirePortals } from "./triggers/expirePortals";

// Callable functions
export { sendTeamInvite } from "./triggers/sendTeamInvite";

// AI Functions
export { analyzeSentiment } from "./ai/analyzeSentiment";
export { detectKnowledgeGaps } from "./ai/detectKnowledgeGaps";
