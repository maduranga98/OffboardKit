import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendEmailSafe } from "../email/sendEmail";

// Runs on the first of each month and emails each company's super_admins
// a CSV summary of every offboarding that closed during the previous
// month. Designed for SOX/GDPR record-keeping — recipients can archive
// the attachment without having to query Firestore.

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce<Set<string>>((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set())
  );
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

export const monthlyComplianceReport = functions.pubsub
  .schedule("0 8 1 * *") // 08:00 UTC on day 1 of each month
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    // Previous calendar month, in UTC.
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    );
    const periodLabel = periodStart.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    const companiesSnap = await db.collection("companies").get();
    for (const companyDoc of companiesSnap.docs) {
      const companyId = companyDoc.id;
      const companyName = (companyDoc.data().name as string) || "Company";

      // Closed flows = completed or cancelled in the period.
      const flowsSnap = await db
        .collection("offboardFlows")
        .where("companyId", "==", companyId)
        .where("status", "in", ["completed", "cancelled"])
        .get();
      const flows = flowsSnap.docs.filter((f) => {
        const ts =
          f.data().completedAt?.toDate?.() ||
          f.data().updatedAt?.toDate?.() ||
          f.data().lastWorkingDay?.toDate?.();
        return ts && ts >= periodStart && ts < periodEnd;
      });

      if (flows.length === 0) continue;

      const rows: Record<string, unknown>[] = [];
      for (const f of flows) {
        const d = f.data();
        const tasksSnap = await db
          .collection("flowTasks")
          .where("flowId", "==", f.id)
          .get();
        const total = tasksSnap.size;
        const completed = tasksSnap.docs.filter(
          (t) => t.data().status === "completed"
        ).length;
        rows.push({
          flowId: f.id,
          employeeName: d.employeeName || "",
          employeeEmail: d.employeeEmail || "",
          employeeRole: d.employeeRole || "",
          department: d.employeeDepartment || "",
          status: d.status || "",
          lastWorkingDay:
            d.lastWorkingDay?.toDate?.()?.toISOString().slice(0, 10) ?? "",
          completedAt:
            d.completedAt?.toDate?.()?.toISOString().slice(0, 10) ?? "",
          tasksTotal: total,
          tasksCompleted: completed,
          progressPercent: d.progressPercent ?? 0,
          approvalStatus: d.approvalStatus || "not_required",
        });
      }

      const csv = buildCsv(rows);
      const filename = `offboardset-${periodStart
        .toISOString()
        .slice(0, 7)}.csv`;
      const csvBase64 = Buffer.from(csv, "utf8").toString("base64");

      const adminsSnap = await db
        .collection("users")
        .where("companyId", "==", companyId)
        .where("role", "in", ["super_admin", "hr_admin"])
        .get();
      if (adminsSnap.empty) continue;
      const recipients = adminsSnap.docs
        .map((d) => ({
          email: d.data().email as string,
          name: (d.data().displayName as string) || "",
        }))
        .filter((r) => !!r.email);

      const html = `<p>Hi team,</p>
        <p>Attached is the offboarding compliance summary for <strong>${companyName}</strong> covering ${periodLabel}.</p>
        <p>${flows.length} offboarding${
        flows.length === 1 ? "" : "s"
      } closed in this period.</p>
        <p>This report is generated automatically on the 1st of each month for audit retention. No action is required if everything looks correct.</p>`;

      await sendEmailSafe({
        to: recipients,
        subject: `Offboarding compliance report — ${periodLabel}`,
        htmlContent: html,
        attachments: [
          {
            content: csvBase64,
            name: filename,
          },
        ],
      });

      // Persist a record of the run so HR has an auditable trail of
      // what was distributed, when.
      const reportRef = db
        .collection("complianceReports")
        .doc();
      await reportRef.set({
        id: reportRef.id,
        companyId,
        periodStart: admin.firestore.Timestamp.fromDate(periodStart),
        periodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
        flowCount: flows.length,
        recipientCount: recipients.length,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
