import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendEmailSafe } from "../email/sendEmail";
import {
  approvalRequestedEmail,
  approvalRejectedEmail,
  portalLinkEmail,
} from "../email/templates";
import { formatLongDate } from "../utils/dates";

const APP_URL = process.env.APP_URL || "https://offboardset.com";

interface ApprovalStepDoc {
  approverId: string;
  approverName: string;
  approverEmail: string;
  status: "waiting" | "pending" | "approved" | "rejected";
  decidedAt: admin.firestore.Timestamp | null;
  note: string;
}

// Reacts to changes in offboardFlows.approvalSteps / approvalStatus so the
// rest of the system stays in sync with each approver decision:
//   1. When the chain's "pending" step shifts to a new approver, email
//      them (and log to the flow audit log).
//   2. When the chain completes, fire the deferred portal email.
//   3. When any approver rejects, notify HR.
export const onFlowApprovalChanged = functions.firestore
  .document("offboardFlows/{flowId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const flowId = context.params.flowId;

    if (!after.approvalSteps || after.approvalStatus === "not_required") {
      return;
    }

    const beforeIdx = (before.currentApproverIndex ?? -1) as number;
    const afterIdx = (after.currentApproverIndex ?? -1) as number;

    const db = admin.firestore();
    const dashboardUrl = `${APP_URL}/offboardings/${flowId}`;
    const lastWorkingDay = formatLongDate(after.lastWorkingDay.toDate());
    const steps = after.approvalSteps as ApprovalStepDoc[];

    // ---- Case 1: full approval ---------------------------------------------
    if (
      before.approvalStatus !== "approved" &&
      after.approvalStatus === "approved"
    ) {
      const companyDoc = await db
        .collection("companies")
        .doc(after.companyId)
        .get();
      const companyName = (companyDoc.data()?.name as string) || "your company";
      const portalUrl = `${APP_URL}/portal/${after.portalToken}`;
      const email = portalLinkEmail({
        employeeName: after.employeeName,
        companyName,
        lastWorkingDay,
        portalUrl,
      });
      await sendEmailSafe({
        to: [
          {
            email: after.employeeEmail as string,
            name: after.employeeName as string,
          },
        ],
        subject: email.subject,
        htmlContent: email.html,
      });
      console.log(
        `Approval chain complete for flow ${flowId} — portal email sent to ${after.employeeEmail}`
      );
      return;
    }

    // ---- Case 2: rejection -------------------------------------------------
    if (
      before.approvalStatus !== "rejected" &&
      after.approvalStatus === "rejected"
    ) {
      const rejectedStep = steps.find((s) => s.status === "rejected");
      if (!rejectedStep) return;
      const hrSnapshot = await db
        .collection("users")
        .where("companyId", "==", after.companyId)
        .where("role", "in", ["hr_admin", "super_admin"])
        .get();
      for (const hrDoc of hrSnapshot.docs) {
        const hr = hrDoc.data();
        const email = approvalRejectedEmail({
          hrName: (hr.displayName as string) || "HR Team",
          employeeName: after.employeeName,
          rejectedBy: rejectedStep.approverName,
          note: rejectedStep.note || "",
          dashboardUrl,
        });
        await sendEmailSafe({
          to: [
            {
              email: hr.email as string,
              name: (hr.displayName as string) || "",
            },
          ],
          subject: email.subject,
          htmlContent: email.html,
        });

        // In-app notification.
        const notifRef = db.collection("notifications").doc();
        await notifRef.set({
          id: notifRef.id,
          companyId: after.companyId,
          userId: hrDoc.id,
          type: "approval_rejected",
          title: `Offboarding rejected: ${after.employeeName}`,
          message: `${rejectedStep.approverName} rejected the request${
            rejectedStep.note ? `: "${rejectedStep.note}"` : ""
          }`,
          link: `/offboardings/${flowId}`,
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      console.log(
        `Approval rejected for flow ${flowId} by ${rejectedStep.approverName}`
      );
      return;
    }

    // ---- Case 3: handoff to next approver ----------------------------------
    if (afterIdx >= 0 && afterIdx !== beforeIdx) {
      const step = steps[afterIdx];
      if (!step || step.status !== "pending") return;
      const email = approvalRequestedEmail({
        approverName: step.approverName,
        employeeName: after.employeeName,
        employeeRole: after.employeeRole,
        lastWorkingDay,
        stepNumber: afterIdx + 1,
        totalSteps: steps.length,
        dashboardUrl,
      });
      await sendEmailSafe({
        to: [{ email: step.approverEmail, name: step.approverName }],
        subject: email.subject,
        htmlContent: email.html,
      });
      const notifRef = db.collection("notifications").doc();
      await notifRef.set({
        id: notifRef.id,
        companyId: after.companyId,
        userId: step.approverId,
        type: "approval_requested",
        title: `Approval needed: ${after.employeeName}`,
        message: `Step ${afterIdx + 1} of ${steps.length}`,
        link: `/offboardings/${flowId}`,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(
        `Approval requested from ${step.approverEmail} for flow ${flowId}`
      );
    }
  });
