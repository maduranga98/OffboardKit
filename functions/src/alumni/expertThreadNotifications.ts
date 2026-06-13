import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { sendEmailSafe } from "../email/sendEmail";
import { emailWrapper, ctaButton, divider } from "../email/templates";

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
const NAVY = "#0F1C2E";
const TEAL = "#0D9E8A";
const MUTED = "#6B7280";

const PORTAL_URL =
  process.env.APP_URL
    ? `${process.env.APP_URL}/alumni-portal/threads`
    : "https://offboardkit.com/alumni-portal/threads";

const HR_APP_URL =
  process.env.APP_URL
    ? `${process.env.APP_URL}/offboardings`
    : "https://offboardkit.com/offboardings";

function buildNewThreadEmail(params: {
  alumniName: string;
  companyName: string;
  hrName: string;
  knowledgeItemTitle: string | null;
  subject: string;
}): string {
  const itemBlock = params.knowledgeItemTitle
    ? `<p style="margin:0 0 16px;font-family:${FONT};font-size:14px;color:${MUTED};">
        This is about: <strong style="color:${NAVY};">${params.knowledgeItemTitle}</strong>
      </p>`
    : "";

  const body = `
    <p style="margin:0 0 20px;font-family:${FONT};font-size:15px;color:${MUTED};line-height:1.5;">
      Hi ${params.alumniName},
    </p>
    <p style="margin:0 0 16px;font-family:${FONT};font-size:15px;color:${NAVY};line-height:1.6;">
      <strong>${params.hrName}</strong> from <strong>${params.companyName}</strong> has a follow-up question about your work.
    </p>
    ${itemBlock}
    <div style="margin:0 0 20px;background:#F5F0E8;border-left:3px solid ${TEAL};border-radius:4px;padding:14px 16px;">
      <p style="margin:0;font-family:${FONT};font-size:15px;color:${NAVY};line-height:1.6;font-style:italic;">
        "${params.subject}"
      </p>
    </div>
    ${ctaButton("Log in to reply", PORTAL_URL)}
    ${divider()}
    <p style="margin:0;font-family:${FONT};font-size:13px;color:${MUTED};line-height:1.6;">
      Your expertise is valued. Thank you for sharing your knowledge.
    </p>
  `;
  return emailWrapper(body);
}

function buildHrReplyEmail(params: {
  alumniName: string;
  subject: string;
}): string {
  const body = `
    <p style="margin:0 0 20px;font-family:${FONT};font-size:15px;color:${MUTED};line-height:1.5;">
      Hi,
    </p>
    <p style="margin:0 0 16px;font-family:${FONT};font-size:15px;color:${NAVY};line-height:1.6;">
      <strong>${params.alumniName}</strong> has replied to your question:
    </p>
    <div style="margin:0 0 20px;background:#F5F0E8;border-left:3px solid ${TEAL};border-radius:4px;padding:14px 16px;">
      <p style="margin:0;font-family:${FONT};font-size:14px;color:${MUTED};line-height:1.6;font-style:italic;">
        "${params.subject}"
      </p>
    </div>
    ${ctaButton("View reply", HR_APP_URL)}
  `;
  return emailWrapper(body);
}

export const onExpertThreadCreated = onDocumentCreated(
  "knowledgeThreads/{threadId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const db = getFirestore();

    let companyName = "Your company";
    try {
      const companySnap = await db.doc(`companies/${data.companyId}`).get();
      const companyData = companySnap.data();
      if (companyData?.name) companyName = companyData.name;
    } catch { /* proceed with default */ }

    await sendEmailSafe({
      to: [{ email: data.alumniEmail, name: data.alumniName }],
      subject: `A question about your previous work at ${companyName}`,
      htmlContent: buildNewThreadEmail({
        alumniName: data.alumniName,
        companyName,
        hrName: data.createdByName,
        knowledgeItemTitle: data.knowledgeItemTitle ?? null,
        subject: data.subject,
      }),
    });
  }
);

export const onExpertThreadUpdated = onDocumentUpdated(
  "knowledgeThreads/{threadId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    if (before.lastMessageBy === after.lastMessageBy) return;
    if (after.lastMessageBy !== "alumni") return;

    const db = getFirestore();

    let hrEmail: string | null = null;
    let hrName: string = after.createdByName ?? "HR";
    try {
      const userSnap = await db.doc(`users/${after.createdBy}`).get();
      const userData = userSnap.data();
      if (userData?.email) hrEmail = userData.email;
      if (userData?.name) hrName = userData.name;
    } catch { /* skip */ }

    if (!hrEmail) return;

    await sendEmailSafe({
      to: [{ email: hrEmail, name: hrName }],
      subject: `${after.alumniName} replied to your question`,
      htmlContent: buildHrReplyEmail({
        alumniName: after.alumniName,
        subject: after.subject,
      }),
    });
  }
);
