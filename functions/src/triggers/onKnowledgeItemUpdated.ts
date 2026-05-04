import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendEmailSafe } from "../email/sendEmail";
import { knowledgeRejectedEmail } from "../email/templates";

const APP_URL = process.env.APP_URL || "https://offboardkit.com";

export const onKnowledgeItemUpdated = functions.firestore
  .document("knowledgeItems/{itemId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    const wasRejected =
      before.managerVerificationStatus !== "rejected" &&
      after.managerVerificationStatus === "rejected";

    if (!wasRejected) return;

    const db = admin.firestore();

    // Look up the offboarding flow to get the employee email + portal token
    const flowId = after.flowId as string | undefined;
    if (!flowId) return;

    const flowDoc = await db.collection("offboardFlows").doc(flowId).get();
    if (!flowDoc.exists) return;
    const flow = flowDoc.data()!;

    const employeeEmail = flow.employeeEmail as string | undefined;
    if (!employeeEmail) return;

    // Look up the manager name
    const verifiedBy = after.managerVerifiedBy as string | undefined;
    let managerName = "Your manager";
    if (verifiedBy) {
      const managerDoc = await db.collection("users").doc(verifiedBy).get();
      if (managerDoc.exists) {
        managerName = (managerDoc.data()?.displayName as string) || managerName;
      }
    }

    const portalToken = flow.portalToken as string | undefined;
    const portalUrl = portalToken
      ? `${APP_URL}/portal/${portalToken}`
      : `${APP_URL}/portal`;

    const email = knowledgeRejectedEmail({
      employeeName: flow.employeeName as string,
      itemTitle: after.title as string,
      managerName,
      portalUrl,
    });

    await sendEmailSafe({
      to: [{ email: employeeEmail, name: flow.employeeName as string }],
      subject: email.subject,
      htmlContent: email.html,
    });
  });
