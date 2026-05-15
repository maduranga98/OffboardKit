import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendEmailSafe } from "../email/sendEmail";
import { gapEscalationEmail } from "../email/templates";

const APP_URL = process.env.APP_URL || "https://hrexitflow.com";
const ESCALATION_DAYS = 7;

export const checkGapEscalation = functions.pubsub
  .schedule("every day 09:30")
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const cutoff = new Date(now.getTime() - ESCALATION_DAYS * 86_400_000);

    // Fetch unresolved critical/high gaps older than cutoff
    const gapsSnap = await db
      .collection("knowledgeItems")
      .where("hasGap", "==", true)
      .where("gapStatus", "!=", "resolved")
      .where("gapSeverity", "in", ["critical", "high"])
      .get();

    if (gapsSnap.empty) {
      console.log("No escalation-worthy gaps found.");
      return;
    }

    const staleDocs = gapsSnap.docs.filter((d) => {
      const createdAt = d.data().createdAt?.toDate() as Date | undefined;
      return createdAt && createdAt < cutoff;
    });

    if (staleDocs.length === 0) {
      console.log("No gaps older than threshold.");
      return;
    }

    // Group by company
    const byCompany: Record<string, typeof staleDocs> = {};
    for (const doc of staleDocs) {
      const cId = doc.data().companyId as string;
      if (!byCompany[cId]) byCompany[cId] = [];
      byCompany[cId].push(doc);
    }

    for (const [companyId, docs] of Object.entries(byCompany)) {
      const hrSnap = await db
        .collection("users")
        .where("companyId", "==", companyId)
        .where("role", "in", ["hr_admin", "super_admin"])
        .get();

      if (hrSnap.empty) continue;

      const gaps = docs.map((d) => {
        const data = d.data();
        const createdAt = data.createdAt?.toDate() as Date | undefined;
        const daysOpen = createdAt
          ? Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000)
          : ESCALATION_DAYS + 1;
        return {
          title: (data.title as string) || "Untitled",
          severity: (data.gapSeverity as string) || "high",
          employeeName: (data.employeeName as string) || "Unknown",
          daysOpen,
        };
      });

      const dashboardUrl = `${APP_URL}/knowledge/gaps`;

      for (const hrDoc of hrSnap.docs) {
        const hr = hrDoc.data();
        const email = gapEscalationEmail({
          hrName: (hr.displayName as string) || "HR Team",
          gaps,
          dashboardUrl,
        });

        await sendEmailSafe({
          to: [{ email: hr.email as string, name: hr.displayName as string }],
          subject: email.subject,
          htmlContent: email.html,
        });

        const notifRef = db.collection("notifications").doc();
        await notifRef.set({
          id: notifRef.id,
          companyId,
          userId: hrDoc.id,
          type: "gap_escalation",
          title: `${gaps.length} knowledge gap${gaps.length > 1 ? "s" : ""} need attention`,
          message: `${gaps.length} critical/high gap${gaps.length > 1 ? "s" : ""} open for ${ESCALATION_DAYS}+ days`,
          link: "/knowledge/gaps",
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    console.log(`Gap escalation check complete. Processed ${staleDocs.length} gaps.`);
  });
