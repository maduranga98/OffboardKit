import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as puppeteer from "puppeteer";
import { sendEmailSafe } from "../email/sendEmail";
import { emailWrapper, ctaButton, divider } from "../email/templates";

const FONT = `-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif`;

const PURPOSE_LABELS: Record<string, string> = {
  job_application: "Job Application",
  visa: "Visa / Immigration",
  loan: "Loan / Mortgage",
  rental: "Rental Agreement",
  other: "Other",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  reference_letter: "Reference Letter",
  employment_verification: "Employment Verification",
};

function buildDeliveryEmail(params: {
  alumniName: string;
  companyName: string;
  docTypeLabel: string;
  documentUrl: string;
  approvedByName: string;
  portalUrl: string;
}): string {
  const firstName = params.alumniName.split(" ")[0];
  const body = `
    <h1 style="margin:0 0 8px;font-family:${FONT};font-size:24px;font-weight:700;color:#0F1C2E;letter-spacing:-0.3px;">
      Your ${params.docTypeLabel} is Ready
    </h1>
    <p style="margin:0 0 20px;font-family:${FONT};font-size:15px;color:#6B7280;line-height:1.5;">
      Hi ${firstName},
    </p>
    <p style="margin:0 0 20px;font-family:${FONT};font-size:15px;color:#0F1C2E;line-height:1.6;">
      Your <strong>${params.docTypeLabel}</strong> requested from <strong>${params.companyName}</strong> is ready to download.
    </p>
    ${ctaButton("Download Document", params.documentUrl)}
    ${divider()}
    <p style="margin:0 0 12px;font-family:${FONT};font-size:13px;color:#6B7280;line-height:1.6;">
      This document was prepared and approved by <strong>${params.approvedByName}</strong>.
      You can also access it any time from your alumni portal.
    </p>
    ${ctaButton("Access Portal", params.portalUrl)}
    ${divider()}
    <p style="margin:0;font-family:${FONT};font-size:12px;color:#9CA3AF;line-height:1.6;">
      Note: Keep this document safe — we recommend downloading a copy.
    </p>
  `;
  return emailWrapper(body);
}

function buildRejectionEmail(params: {
  alumniName: string;
  companyName: string;
  docTypeLabel: string;
  rejectionReason?: string | null;
}): string {
  const firstName = params.alumniName.split(" ")[0];
  const body = `
    <h1 style="margin:0 0 8px;font-family:${FONT};font-size:24px;font-weight:700;color:#0F1C2E;letter-spacing:-0.3px;">
      Update on your document request
    </h1>
    <p style="margin:0 0 20px;font-family:${FONT};font-size:15px;color:#6B7280;line-height:1.5;">
      Hi ${firstName},
    </p>
    <p style="margin:0 0 20px;font-family:${FONT};font-size:15px;color:#0F1C2E;line-height:1.6;">
      Unfortunately we're unable to process your <strong>${params.docTypeLabel}</strong> request at this time.
    </p>
    ${
      params.rejectionReason
        ? `<div style="background:#FEF2F2;border-left:4px solid #DC2626;border-radius:0 6px 6px 0;padding:16px 20px;margin-bottom:20px;">
            <p style="margin:0;font-family:${FONT};font-size:14px;color:#991B1B;line-height:1.5;">
              <strong>Reason:</strong> ${params.rejectionReason}
            </p>
          </div>`
        : ""
    }
    <p style="margin:0;font-family:${FONT};font-size:13px;color:#6B7280;line-height:1.6;">
      If you believe this is an error, please contact your former HR team at <strong>${params.companyName}</strong> directly.
    </p>
  `;
  return emailWrapper(body);
}

function buildVerificationHtml(params: {
  companyName: string;
  alumniName: string;
  role: string;
  department: string;
  tenureStr: string;
  startDateStr: string;
  exitDateStr: string;
  purposeLabel: string;
  purposeDetails: string;
  approvedByName: string;
  requestId: string;
  purpose: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0F1C2E; margin: 0; padding: 0; }
    .page { padding: 60px; max-width: 680px; margin: 0 auto; }
    .header { border-bottom: 2px solid #0D9E8A; padding-bottom: 20px; margin-bottom: 32px; }
    .company-name { font-size: 22px; font-weight: 700; color: #0F1C2E; }
    .date { color: #6B7280; font-size: 13px; margin-top: 4px; }
    h2 { font-size: 16px; font-weight: 600; color: #0F1C2E; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 24px; }
    .field { margin-bottom: 12px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #6B7280; margin-bottom: 2px; }
    .value { font-size: 15px; color: #0F1C2E; font-weight: 500; }
    .body-text { font-size: 14px; line-height: 1.7; color: #374151; margin: 24px 0; }
    .signature { margin-top: 48px; }
    .sig-name { font-weight: 600; font-size: 15px; margin: 0; }
    .sig-title { color: #6B7280; font-size: 13px; margin: 4px 0 0; }
    .footer { border-top: 1px solid #E5E7EB; margin-top: 48px; padding-top: 16px; font-size: 11px; color: #9CA3AF; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="company-name">${params.companyName}</div>
      <div class="date">Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
    </div>
    <h2>To Whom It May Concern</h2>
    <p class="body-text">
      This letter serves as official confirmation that <strong>${params.alumniName}</strong>
      was employed with <strong>${params.companyName}</strong> in the capacity of
      <strong>${params.role}</strong> within the <strong>${params.department}</strong>
      department for a period of <strong>${params.tenureStr}</strong>.
    </p>
    <div class="field">
      <div class="label">Employee Name</div>
      <div class="value">${params.alumniName}</div>
    </div>
    <div class="field">
      <div class="label">Position Held</div>
      <div class="value">${params.role}</div>
    </div>
    <div class="field">
      <div class="label">Department</div>
      <div class="value">${params.department}</div>
    </div>
    <div class="field">
      <div class="label">Employment Period</div>
      <div class="value">${params.startDateStr} — ${params.exitDateStr}</div>
    </div>
    <div class="field">
      <div class="label">Total Tenure</div>
      <div class="value">${params.tenureStr}</div>
    </div>
    <p class="body-text">
      This letter is issued for the purpose of
      <strong>${params.purposeLabel}</strong>${params.purposeDetails ? ` (${params.purposeDetails})` : ""}
      and should not be construed as a character reference.
    </p>
    <div class="signature">
      <p class="sig-name">${params.approvedByName || "HR Department"}</p>
      <p class="sig-title">HR Team, ${params.companyName}</p>
    </div>
    <div class="footer">
      This document was generated by OffboardKit on behalf of ${params.companyName}.
      Document ID: ${params.requestId}
    </div>
  </div>
</body>
</html>`;
}

function buildReferenceHtml(params: {
  companyName: string;
  alumniName: string;
  firstName: string;
  role: string;
  department: string;
  tenureStr: string;
  startDateStr: string;
  exitDateStr: string;
  approvedByName: string;
  requestId: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0F1C2E; margin: 0; padding: 0; }
    .page { padding: 60px; max-width: 680px; margin: 0 auto; }
    .header { border-bottom: 2px solid #0D9E8A; padding-bottom: 20px; margin-bottom: 32px; }
    .company-name { font-size: 22px; font-weight: 700; color: #0F1C2E; }
    .date { color: #6B7280; font-size: 13px; margin-top: 4px; }
    h2 { font-size: 16px; font-weight: 600; color: #0F1C2E; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 24px; }
    .body-text { font-size: 14px; line-height: 1.7; color: #374151; margin: 24px 0; }
    .signature { margin-top: 48px; }
    .sig-name { font-weight: 600; font-size: 15px; margin: 0; }
    .sig-title { color: #6B7280; font-size: 13px; margin: 4px 0 0; }
    .footer { border-top: 1px solid #E5E7EB; margin-top: 48px; padding-top: 16px; font-size: 11px; color: #9CA3AF; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="company-name">${params.companyName}</div>
      <div class="date">Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
    </div>
    <h2>To Whom It May Concern</h2>
    <p class="body-text">
      I am pleased to confirm that <strong>${params.alumniName}</strong> was a valued member
      of our team at <strong>${params.companyName}</strong>, serving as
      <strong>${params.role}</strong> in the <strong>${params.department}</strong>
      department from ${params.startDateStr} to ${params.exitDateStr}, a tenure of
      <strong>${params.tenureStr}</strong>.
    </p>
    <p class="body-text">
      During their time with us, they demonstrated professionalism and dedication to their work.
      We wish ${params.firstName} the very best in their future endeavours.
    </p>
    <div class="signature">
      <p class="sig-name">${params.approvedByName || "HR Department"}</p>
      <p class="sig-title">HR Team, ${params.companyName}</p>
    </div>
    <div class="footer">
      This document was generated by OffboardKit on behalf of ${params.companyName}.
      Document ID: ${params.requestId}
    </div>
  </div>
</body>
</html>`;
}

function buildOverrideHtml(params: {
  companyName: string;
  alumniName: string;
  approvedByName: string;
  requestId: string;
  bodyText: string;
}): string {
  const paragraphs = params.bodyText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="body-text">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n    ");

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0F1C2E; margin: 0; padding: 0; }
    .page { padding: 60px; max-width: 680px; margin: 0 auto; }
    .header { border-bottom: 2px solid #0D9E8A; padding-bottom: 20px; margin-bottom: 32px; }
    .company-name { font-size: 22px; font-weight: 700; color: #0F1C2E; }
    .date { color: #6B7280; font-size: 13px; margin-top: 4px; }
    h2 { font-size: 16px; font-weight: 600; color: #0F1C2E; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 24px; }
    .body-text { font-size: 14px; line-height: 1.7; color: #374151; margin: 24px 0; }
    .signature { margin-top: 48px; }
    .sig-name { font-weight: 600; font-size: 15px; margin: 0; }
    .sig-title { color: #6B7280; font-size: 13px; margin: 4px 0 0; }
    .footer { border-top: 1px solid #E5E7EB; margin-top: 48px; padding-top: 16px; font-size: 11px; color: #9CA3AF; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="company-name">${params.companyName}</div>
      <div class="date">Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
    </div>
    <h2>To Whom It May Concern</h2>
    ${paragraphs}
    <div class="signature">
      <p class="sig-name">${params.approvedByName || "HR Department"}</p>
      <p class="sig-title">HR Team, ${params.companyName}</p>
    </div>
    <div class="footer">
      This document was generated by OffboardKit on behalf of ${params.companyName}.
      Document ID: ${params.requestId}
    </div>
  </div>
</body>
</html>`;
}

function calcTenure(startDate: Date, exitDate: Date): string {
  const ms = exitDate.getTime() - startDate.getTime();
  const totalMonths = Math.floor(ms / (30.44 * 24 * 60 * 60 * 1000));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years > 0 && months > 0) {
    return `${years} year${years > 1 ? "s" : ""} and ${months} month${months > 1 ? "s" : ""}`;
  } else if (years > 0) {
    return `${years} year${years > 1 ? "s" : ""}`;
  }
  return `${months} month${months !== 1 ? "s" : ""}`;
}

export const generateDocument = onDocumentUpdated(
  { document: "docRequests/{requestId}", memory: "2GiB", timeoutSeconds: 300 },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Handle approval → generate PDF
    if (before.status !== "approved" && after.status === "approved") {
      const requestId = event.params.requestId;
      const db = getFirestore();

      try {
        const [alumniSnap, companySnap] = await Promise.all([
          db.collection("alumniProfiles").doc(after.alumniId).get(),
          db.collection("companies").doc(after.companyId).get(),
        ]);
        const alumni = alumniSnap.data();
        const company = companySnap.data();

        if (!alumni || !company) {
          console.error("generateDocument: missing alumni or company data");
          return;
        }

        let startDate: Date;
        const exitDate: Date = alumni.exitDate?.toDate
          ? alumni.exitDate.toDate()
          : new Date();

        if (alumni.flowId) {
          try {
            const flowSnap = await db.collection("offboardFlows").doc(alumni.flowId).get();
            const flow = flowSnap.data();
            startDate = flow?.startDate?.toDate
              ? flow.startDate.toDate()
              : new Date(Date.now() - (alumni.tenureMonths || 0) * 30 * 24 * 60 * 60 * 1000);
          } catch {
            startDate = new Date(Date.now() - (alumni.tenureMonths || 0) * 30 * 24 * 60 * 60 * 1000);
          }
        } else {
          startDate = new Date(Date.now() - (alumni.tenureMonths || 0) * 30 * 24 * 60 * 60 * 1000);
        }

        const tenureStr = calcTenure(startDate, exitDate);
        const fmtDate = (d: Date) =>
          d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

        const letterBodyOverride: string | null = after.letterBodyOverride || null;

        const html = letterBodyOverride
          ? buildOverrideHtml({
              companyName: company.name,
              alumniName: alumni.name,
              approvedByName: after.approvedByName || "HR Department",
              requestId,
              bodyText: letterBodyOverride,
            })
          : after.type === "employment_verification"
          ? buildVerificationHtml({
              companyName: company.name,
              alumniName: alumni.name,
              role: alumni.role || "Team Member",
              department: alumni.department || "—",
              tenureStr,
              startDateStr: fmtDate(startDate),
              exitDateStr: fmtDate(exitDate),
              purposeLabel: PURPOSE_LABELS[after.purpose as string] || after.purpose,
              purposeDetails: after.purposeDetails || "",
              approvedByName: after.approvedByName || "HR Department",
              requestId,
              purpose: after.purpose,
            })
          : buildReferenceHtml({
              companyName: company.name,
              alumniName: alumni.name,
              firstName: alumni.name.split(" ")[0],
              role: alumni.role || "Team Member",
              department: alumni.department || "—",
              tenureStr,
              startDateStr: fmtDate(startDate),
              exitDateStr: fmtDate(exitDate),
              approvedByName: after.approvedByName || "HR Department",
              requestId,
            });

        // Generate PDF
        const browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });
        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "0", right: "0", bottom: "0", left: "0" },
        });
        await browser.close();

        // Upload to Storage
        const bucket = getStorage().bucket();
        const filePath = `documents/${after.companyId}/${after.alumniId}/${requestId}.pdf`;
        const file = bucket.file(filePath);
        await file.save(Buffer.from(pdfBuffer), { contentType: "application/pdf" });

        const [signedUrls] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });
        const documentUrl = signedUrls;

        // Update docRequest
        await db.collection("docRequests").doc(requestId).update({
          status: "delivered",
          documentUrl,
          deliveredAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Send delivery email
        const docTypeLabel = DOC_TYPE_LABELS[after.type as string] || after.type;
        const portalUrl = process.env.APP_URL
          ? `${process.env.APP_URL}/alumni-portal/documents`
          : "https://offboardset.com/alumni-portal/documents";

        await sendEmailSafe({
          to: [{ email: after.alumniEmail, name: after.alumniName }],
          subject: `Your ${docTypeLabel} is Ready — ${company.name}`,
          htmlContent: buildDeliveryEmail({
            alumniName: after.alumniName,
            companyName: company.name,
            docTypeLabel,
            documentUrl,
            approvedByName: after.approvedByName || "HR Department",
            portalUrl,
          }),
        });
      } catch (error) {
        console.error("generateDocument error:", error);
        await db
          .collection("docRequests")
          .doc(requestId)
          .update({
            lastError: error instanceof Error ? error.message : String(error),
            updatedAt: FieldValue.serverTimestamp(),
          })
          .catch(() => {});
      }
    }
  }
);

export const onDocumentRejected = onDocumentUpdated(
  "docRequests/{requestId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === "rejected" || after.status !== "rejected") return;

    try {
      const db = getFirestore();
      const companySnap = await db.collection("companies").doc(after.companyId).get();
      const company = companySnap.data();
      const companyName = company?.name || "Your former employer";
      const docTypeLabel = DOC_TYPE_LABELS[after.type as string] || after.type;

      await sendEmailSafe({
        to: [{ email: after.alumniEmail, name: after.alumniName }],
        subject: `Update on your document request — ${companyName}`,
        htmlContent: buildRejectionEmail({
          alumniName: after.alumniName,
          companyName,
          docTypeLabel,
          rejectionReason: after.rejectionReason || null,
        }),
      });
    } catch (error) {
      console.error("onDocumentRejected email error:", error);
    }
  }
);
