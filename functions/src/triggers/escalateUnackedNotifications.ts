import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendEmailSafe } from "../email/sendEmail";

// Daily sweep: any actionable notification (task overdue, approval
// request, risk flag) more than 3 days old that hasn't been
// acknowledged is escalated to every super_admin in the company. A
// separate notification doc is created for each super_admin so each one
// sees it independently, and the original is flagged escalatedAt so it
// can only escalate once.
const ACTIONABLE_TYPES = [
  "task_overdue",
  "approval_requested",
  "risk_flag",
  "approval_rejected",
];

const ESCALATION_AFTER_DAYS = 3;

export const escalateUnackedNotifications = functions.pubsub
  .schedule("every day 10:00")
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ESCALATION_AFTER_DAYS);

    const stale = await db
      .collection("notifications")
      .where("type", "in", ACTIONABLE_TYPES)
      .where("createdAt", "<", admin.firestore.Timestamp.fromDate(cutoff))
      .get();

    let escalated = 0;
    for (const docSnap of stale.docs) {
      const n = docSnap.data();
      if (n.ackedAt || n.escalatedAt) continue;
      if (!n.companyId || !n.userId) continue;

      // Find super_admins in the company excluding the original
      // recipient (they already got it).
      const adminsSnap = await db
        .collection("users")
        .where("companyId", "==", n.companyId)
        .where("role", "==", "super_admin")
        .get();
      const admins = adminsSnap.docs.filter((d) => d.id !== n.userId);
      if (admins.length === 0) continue;

      for (const adminDoc of admins) {
        const a = adminDoc.data();
        const ref = db.collection("notifications").doc();
        await ref.set({
          id: ref.id,
          companyId: n.companyId,
          userId: adminDoc.id,
          type: n.type,
          title: `[Escalated] ${n.title || "Action required"}`,
          message: `Not acknowledged for ${ESCALATION_AFTER_DAYS}+ days. ${
            n.message || ""
          }`.trim(),
          link: n.link || "",
          isRead: false,
          escalatedFrom: docSnap.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        if (a.email) {
          await sendEmailSafe({
            to: [
              {
                email: a.email as string,
                name: (a.displayName as string) || "",
              },
            ],
            subject: `[Escalated] ${n.title || "Action required"}`,
            htmlContent: `<p>A pending action hasn't been acknowledged in ${ESCALATION_AFTER_DAYS}+ days:</p>
              <p><strong>${n.title || ""}</strong></p>
              <p>${n.message || ""}</p>
              <p>This is now your responsibility.</p>`,
          });
        }
      }
      await docSnap.ref.update({
        escalatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      escalated++;
    }

    console.log(
      `Escalation sweep complete: scanned ${stale.size}, escalated ${escalated}`
    );
  });
