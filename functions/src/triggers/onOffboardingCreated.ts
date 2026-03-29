import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendEmailSafe } from "../email/sendEmail";
import {
  portalLinkEmail,
  offboardingStartedEmail,
  taskAssignedEmail,
} from "../email/templates";
import { formatLongDate, formatShortDate } from "../utils/dates";

const APP_URL = process.env.APP_URL || "https://offboardkit.com";

export const onOffboardingCreated = functions.firestore
  .document("offboardFlows/{flowId}")
  .onCreate(async (snapshot, context) => {
    const flow = snapshot.data();
    const flowId = context.params.flowId;
    const db = admin.firestore();

    // 1. Fetch company details
    const companyDoc = await db.collection("companies").doc(flow.companyId).get();
    const company = companyDoc.data();
    if (!company) {
      console.error(`Company ${flow.companyId} not found — aborting email trigger for flow ${flowId}`);
      return;
    }

    const portalUrl = `${APP_URL}/portal/${flow.portalToken}`;
    const dashboardUrl = `${APP_URL}/offboardings/${flowId}`;
    const lastWorkingDay = formatLongDate(flow.lastWorkingDay.toDate());

    // 2. Send portal link to departing employee
    const portalEmail = portalLinkEmail({
      employeeName: flow.employeeName,
      companyName: company.name as string,
      lastWorkingDay,
      portalUrl,
    });
    await sendEmailSafe({
      to: [{ email: flow.employeeEmail as string, name: flow.employeeName as string }],
      subject: portalEmail.subject,
      htmlContent: portalEmail.html,
    });

    // 3. Notify HR admins + create in-app notifications
    const hrSnapshot = await db
      .collection("users")
      .where("companyId", "==", flow.companyId)
      .where("role", "in", ["hr_admin", "super_admin"])
      .get();

    for (const hrDoc of hrSnapshot.docs) {
      const hr = hrDoc.data();

      const hrEmail = offboardingStartedEmail({
        hrName: (hr.displayName as string) || "HR Team",
        employeeName: flow.employeeName as string,
        employeeRole: flow.employeeRole as string,
        department: flow.employeeDepartment as string,
        lastWorkingDay,
        dashboardUrl,
      });
      await sendEmailSafe({
        to: [{ email: hr.email as string, name: hr.displayName as string }],
        subject: hrEmail.subject,
        htmlContent: hrEmail.html,
      });

      // In-app notification for HR admin
      const notifRef = db.collection("notifications").doc();
      await notifRef.set({
        id: notifRef.id,
        companyId: flow.companyId,
        userId: hrDoc.id,
        type: "offboarding_started",
        title: `Offboarding started: ${flow.employeeName}`,
        message: `${flow.employeeName} (${flow.employeeRole}) — last day ${lastWorkingDay}`,
        link: `/offboardings/${flowId}`,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // 4. Send task assignment emails for any pre-loaded tasks
    const tasksSnapshot = await db
      .collection("flowTasks")
      .where("flowId", "==", flowId)
      .get();

    for (const taskDoc of tasksSnapshot.docs) {
      const task = taskDoc.data();
      if (!task.assigneeEmail) continue;

      const dueDate = task.dueDate
        ? formatShortDate(task.dueDate.toDate())
        : "—";

      const email = taskAssignedEmail({
        assigneeName: (task.assigneeName as string) || task.assigneeRole as string,
        employeeName: flow.employeeName as string,
        taskTitle: task.title as string,
        dueDate,
        dashboardUrl,
      });
      await sendEmailSafe({
        to: [{ email: task.assigneeEmail as string, name: task.assigneeName as string }],
        subject: email.subject,
        htmlContent: email.html,
      });
    }

    console.log(
      `Offboarding emails sent for ${flow.employeeName} (flowId=${flowId}). HR notified: ${hrSnapshot.size}, tasks: ${tasksSnapshot.size}`
    );
  });
