import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import * as puppeteer from "puppeteer";

interface GenerateLetterRequest {
  templateId: string;
  alumniId: string;
  companyId: string;
  letterDate: string;
  recipientLine: string;
  customSubject: string;
  customBody: string;
  customClosing: string;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function applyReplacements(text: string, replacements: Record<string, string>): string {
  return text.replace(/\{\{[^}]+\}\}/g, (match) => replacements[match] ?? match);
}

function buildLetterHtml(opts: {
  companyName: string;
  letterDate: string;
  recipientLine: string;
  subject: string;
  body: string;
  closing: string;
}): string {
  const { companyName, letterDate, recipientLine, subject, body, closing } = opts;

  const subjectHtml = subject
    ? `<p style="font-weight:700;text-transform:uppercase;font-size:13px;letter-spacing:0.05em;margin:0 0 20px 0;color:#0F1C2E;">${subject}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Letter</title>
</head>
<body style="margin:0;padding:0;background:#fff;">
<div style="max-width:680px;margin:auto;padding:56px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#0F1C2E;line-height:1.75;">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0D9E8A;margin-bottom:40px;padding-bottom:16px;">
    <span style="font-weight:700;font-size:20px;color:#0F1C2E;">${companyName}</span>
    <span style="font-size:13px;color:#6B7280;">${letterDate}</span>
  </div>

  <!-- Recipient -->
  <p style="margin:0 0 20px 0;">${recipientLine},</p>

  <!-- Subject -->
  ${subjectHtml}

  <!-- Body -->
  <p style="white-space:pre-wrap;margin:0 0 44px 0;">${body}</p>

  <!-- Closing -->
  <p style="margin:0 0 64px 0;">${closing}</p>

  <!-- Signature block -->
  <div>
    <div style="width:160px;border-top:1px solid #9CA3AF;margin-bottom:8px;"></div>
    <p style="margin:0;font-size:12px;color:#6B7280;">Human Resources</p>
    <p style="margin:4px 0 0 0;font-size:12px;color:#6B7280;">${companyName}</p>
  </div>

  <!-- Footer -->
  <div style="margin-top:64px;border-top:1px solid #E5E7EB;padding-top:12px;display:flex;justify-content:space-between;font-size:11px;color:#9CA3AF;">
    <span>Confidential — ${companyName}</span>
    <span>Generated via OffboardKit</span>
  </div>

</div>
</body>
</html>`;
}

export const generateLetterPdf = functions
  .runWith({ memory: "1GB", timeoutSeconds: 120 })
  .https.onCall(async (data: GenerateLetterRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User is not authenticated"
      );
    }

    const { alumniId, companyId, letterDate, recipientLine, customSubject, customBody, customClosing } = data;
    const db = getFirestore();

    const [alumniSnap, companySnap] = await Promise.all([
      db.collection("alumniProfiles").doc(alumniId).get(),
      db.collection("companies").doc(companyId).get(),
    ]);

    if (!alumniSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Alumni profile not found");
    }

    const alumni = alumniSnap.data() as {
      name: string;
      role: string;
      department: string;
      exitDate: { toDate: () => Date };
    };
    const company = (companySnap.data() ?? {}) as { name?: string };

    const companyName = company.name ?? "Your Company";
    const exitDateStr = alumni.exitDate
      ? formatDate(alumni.exitDate.toDate())
      : "";
    const letterDateStr = formatDate(new Date(letterDate));

    const replacements: Record<string, string> = {
      "{{employee_name}}": alumni.name,
      "{{role}}": alumni.role,
      "{{department}}": alumni.department,
      "{{exit_date}}": exitDateStr,
      "{{company_name}}": companyName,
      "{{letter_date}}": letterDateStr,
    };

    const resolvedSubject = applyReplacements(customSubject, replacements);
    const resolvedBody = applyReplacements(customBody, replacements);

    const html = buildLetterHtml({
      companyName,
      letterDate: letterDateStr,
      recipientLine,
      subject: resolvedSubject,
      body: resolvedBody,
      closing: customClosing,
    });

    let browser: puppeteer.Browser | null = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        margin: { top: "48px", right: "56px", bottom: "48px", left: "56px" },
        printBackground: true,
      });

      return {
        success: true,
        pdf: Buffer.from(pdfBuffer).toString("base64"),
        fileName: `${alumni.name.replace(/\s+/g, "_")}_Letter_${letterDate}.pdf`,
      };
    } finally {
      if (browser) await browser.close();
    }
  });
