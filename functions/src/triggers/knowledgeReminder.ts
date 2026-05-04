import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendEmailSafe } from "../email/sendEmail";
import { knowledgeReminderEmail } from "../email/templates";
import { formatShortDate } from "../utils/dates";

const APP_URL = process.env.APP_URL || "https://offboardkit.com";
// Send reminder when <= this many days remain and 0 items submitted
const REMINDER_DAYS_THRESHOLD = 5;

export const sendKnowledgeReminders = functions.pubsub
  .schedule("every day 10:00")
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();

    // Active flows where last working day is within the threshold
    const activeFlowsSnap = await db
      .collection("offboardFlows")
      .where("status", "in", ["not_started", "in_progress"])
      .get();

    if (activeFlowsSnap.empty) return;

    let remindersSent = 0;

    for (const flowDoc of activeFlowsSnap.docs) {
      const flow = flowDoc.data();

      const lastWorkingDay = flow.lastWorkingDay?.toDate() as Date | undefined;
      if (!lastWorkingDay) continue;

      const daysRemaining = Math.ceil(
        (lastWorkingDay.getTime() - now.getTime()) / 86_400_000
      );

      // Only remind if last day is in the future and within threshold
      if (daysRemaining <= 0 || daysRemaining > REMINDER_DAYS_THRESHOLD) continue;

      const employeeEmail = flow.employeeEmail as string | undefined;
      if (!employeeEmail) continue;

      // Check if employee has submitted any knowledge items
      const itemsSnap = await db
        .collection("knowledgeItems")
        .where("flowId", "==", flowDoc.id)
        .where("submittedBy", "==", "employee")
        .limit(1)
        .get();

      if (!itemsSnap.empty) continue; // Already submitted something

      const portalToken = flow.portalToken as string | undefined;
      const portalUrl = portalToken
        ? `${APP_URL}/portal/${portalToken}`
        : `${APP_URL}/portal`;

      // Look up company name
      let companyName = "your company";
      if (flow.companyId) {
        const companyDoc = await db.collection("companies").doc(flow.companyId as string).get();
        if (companyDoc.exists) {
          companyName = (companyDoc.data()?.name as string) || companyName;
        }
      }

      const email = knowledgeReminderEmail({
        employeeName: flow.employeeName as string,
        companyName,
        lastWorkingDay: formatShortDate(lastWorkingDay),
        portalUrl,
        daysRemaining,
      });

      await sendEmailSafe({
        to: [{ email: employeeEmail, name: flow.employeeName as string }],
        subject: email.subject,
        htmlContent: email.html,
      });

      remindersSent++;
    }

    console.log(`Knowledge reminder check complete. Sent ${remindersSent} reminders.`);
  });
