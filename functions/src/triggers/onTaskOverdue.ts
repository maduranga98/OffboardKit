import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendEmailSafe } from "../email/sendEmail";
import { taskOverdueEmail } from "../email/templates";
import { formatShortDate } from "../utils/dates";

const APP_URL = process.env.APP_URL || "https://offboardkit.com";

// Firestore 'in' query limit
const FIRESTORE_IN_LIMIT = 30;

export const checkOverdueTasks = functions.pubsub
  .schedule("every day 09:00")
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();

    // 1. Fetch all active offboarding flows
    const activeFlowsSnap = await db
      .collection("offboardFlows")
      .where("status", "in", ["not_started", "in_progress"])
      .get();

    if (activeFlowsSnap.empty) {
      console.log("No active offboarding flows — daily overdue check done.");
      return;
    }

    // 2. Group flows by company
    const flowsByCompany: Record<
      string,
      FirebaseFirestore.QueryDocumentSnapshot[]
    > = {};
    for (const doc of activeFlowsSnap.docs) {
      const companyId = doc.data().companyId as string;
      if (!flowsByCompany[companyId]) flowsByCompany[companyId] = [];
      flowsByCompany[companyId].push(doc);
    }

    // 3. Process each company
    for (const [companyId, flows] of Object.entries(flowsByCompany)) {
      // Fetch HR admins for this company
      const hrSnap = await db
        .collection("users")
        .where("companyId", "==", companyId)
        .where("role", "in", ["hr_admin", "super_admin"])
        .get();

      if (hrSnap.empty) continue;

      // Firestore 'in' supports max 30 items — slice to be safe
      const batchedIds = flows.slice(0, FIRESTORE_IN_LIMIT).map((f) => f.id);

      const tasksSnap = await db
        .collection("flowTasks")
        .where("flowId", "in", batchedIds)
        .where("status", "in", ["pending", "in_progress"])
        .get();

      // Filter to tasks whose dueDate is in the past
      const overdueDocs = tasksSnap.docs.filter((t) => {
        const dueDate = t.data().dueDate?.toDate() as Date | undefined;
        return dueDate && dueDate < now;
      });

      if (overdueDocs.length === 0) continue;

      // Group overdue tasks by flowId
      const overdueByFlow: Record<
        string,
        { title: string; assigneeRole: string; dueDate: string }[]
      > = {};
      for (const taskDoc of overdueDocs) {
        const task = taskDoc.data();
        const fId = task.flowId as string;
        if (!overdueByFlow[fId]) overdueByFlow[fId] = [];
        overdueByFlow[fId].push({
          title: task.title as string,
          assigneeRole: task.assigneeRole as string,
          dueDate: formatShortDate(task.dueDate.toDate()),
        });
      }

      // Send one email + notification per flow → per HR admin
      for (const [flowId, overdueTasks] of Object.entries(overdueByFlow)) {
        const flowDoc = flows.find((f) => f.id === flowId);
        if (!flowDoc) continue;
        const flowData = flowDoc.data();
        const dashboardUrl = `${APP_URL}/offboardings/${flowId}`;

        for (const hrDoc of hrSnap.docs) {
          const hr = hrDoc.data();

          const email = taskOverdueEmail({
            hrName: (hr.displayName as string) || "HR Team",
            employeeName: flowData.employeeName as string,
            overdueTasks,
            dashboardUrl,
          });
          await sendEmailSafe({
            to: [{ email: hr.email as string, name: hr.displayName as string }],
            subject: email.subject,
            htmlContent: email.html,
          });

          // In-app notification
          const notifRef = db.collection("notifications").doc();
          await notifRef.set({
            id: notifRef.id,
            companyId,
            userId: hrDoc.id,
            type: "task_overdue",
            title: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""}: ${flowData.employeeName}`,
            message: overdueTasks.map((t) => t.title).join(", "),
            link: `/offboardings/${flowId}`,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }

    console.log("Daily overdue task check completed.");
  });
