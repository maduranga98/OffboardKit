import * as admin from "firebase-admin";

admin.initializeApp();

// Firestore triggers
export { onOffboardingCreated } from "./triggers/onOffboardingCreated";

// Scheduled functions
export { checkOverdueTasks } from "./triggers/onTaskOverdue";
