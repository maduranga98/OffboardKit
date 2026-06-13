import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { sendEmailSafe } from "../email/sendEmail";
import { emailWrapper, ctaButton, divider } from "../email/templates";

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
const NAVY = "#0F1C2E";
const TEAL = "#0D9E8A";
const MUTED = "#6B7280";

const ENGAGEMENT_LABELS: Record<string, string> = {
  one_time: "One-time Project",
  ongoing:  "Ongoing Engagement",
  advisory: "Advisory / Consulting",
};

function fmtBudget(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `From ${fmt(min)}`;
  if (max != null) return `Up to ${fmt(max)}`;
  return null;
}

function buildGigRequestEmail(params: {
  alumniName: string;
  companyName: string;
  createdByName: string;
  title: string;
  engagementType: string;
  budget: string | null;
  timelineWeeks: number | null;
  portalUrl: string;
}): string {
  const body = `
    <p style="margin:0 0 4px;font-family:${FONT};font-size:12px;font-weight:600;color:${TEAL};text-transform:uppercase;letter-spacing:0.05em;">
      Consulting Opportunity
    </p>
    <h1 style="margin:0 0 16px;font-family:${FONT};font-size:22px;font-weight:700;color:${NAVY};letter-spacing:-0.3px;">
      A consulting opportunity from ${params.companyName}
    </h1>
    <p style="margin:0 0 20px;font-family:${FONT};font-size:15px;color:${NAVY};line-height:1.6;">
      Hi ${params.alumniName},
    </p>
    <p style="margin:0 0 20px;font-family:${FONT};font-size:15px;color:${MUTED};line-height:1.6;">
      ${params.createdByName} from ${params.companyName} has sent you a consulting request.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#F8FAFB;border-radius:8px;border:1px solid #E8ECF0;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 8px;font-family:${FONT};font-size:13px;color:${MUTED};">Project</p>
        <p style="margin:0 0 12px;font-family:${FONT};font-size:15px;font-weight:600;color:${NAVY};">${params.title}</p>
        <p style="margin:0 0 4px;font-family:${FONT};font-size:13px;color:${MUTED};">Type: ${ENGAGEMENT_LABELS[params.engagementType] ?? params.engagementType}</p>
        ${params.budget ? `<p style="margin:0 0 4px;font-family:${FONT};font-size:13px;color:${MUTED};">Budget: ${params.budget}</p>` : ""}
        ${params.timelineWeeks ? `<p style="margin:0;font-family:${FONT};font-size:13px;color:${MUTED};">Timeline: ${params.timelineWeeks} weeks</p>` : ""}
      </td></tr>
    </table>
    ${ctaButton("Review & Respond", params.portalUrl)}
    ${divider()}
    <p style="margin:0;font-family:${FONT};font-size:13px;color:${MUTED};line-height:1.6;">
      No obligation — you can decline if it's not a fit.
    </p>
  `;
  return emailWrapper(body);
}

function buildHrResponseEmail(params: {
  hrName: string;
  alumniName: string;
  alumniEmail: string;
  title: string;
  status: "accepted" | "declined";
  alumniNote: string | null;
  poolUrl: string;
}): string {
  const isAccepted = params.status === "accepted";
  const body = `
    <h1 style="margin:0 0 16px;font-family:${FONT};font-size:22px;font-weight:700;color:${NAVY};letter-spacing:-0.3px;">
      ${isAccepted ? `${params.alumniName} accepted your gig request` : `${params.alumniName} declined your gig request`}
    </h1>
    <p style="margin:0 0 20px;font-family:${FONT};font-size:15px;color:${NAVY};line-height:1.6;">
      Hi ${params.hrName},
    </p>
    ${isAccepted
      ? `<p style="margin:0 0 20px;font-family:${FONT};font-size:15px;color:${MUTED};line-height:1.6;">
           Great news — ${params.alumniName} has accepted: "${params.title}".
           Reach out at <a href="mailto:${params.alumniEmail}" style="color:${TEAL};">${params.alumniEmail}</a> to coordinate.
         </p>`
      : `<p style="margin:0 0 20px;font-family:${FONT};font-size:15px;color:${MUTED};line-height:1.6;">
           ${params.alumniName} declined: "${params.title}".
         </p>`
    }
    ${params.alumniNote
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#F8FAFB;border-radius:8px;border:1px solid #E8ECF0;">
           <tr><td style="padding:16px 20px;">
             <p style="margin:0 0 4px;font-family:${FONT};font-size:12px;color:${MUTED};">Their note</p>
             <p style="margin:0;font-family:${FONT};font-size:14px;color:${NAVY};line-height:1.5;">"${params.alumniNote}"</p>
           </td></tr>
         </table>`
      : ""
    }
    ${!isAccepted
      ? `<p style="margin:0 0 20px;font-family:${FONT};font-size:13px;color:${MUTED};">
           You can find other consultants in your Alumni → Consulting Pool.
         </p>`
      : ""
    }
    ${ctaButton("View Consulting Pool", params.poolUrl)}
    ${divider()}
  `;
  return emailWrapper(body);
}

export const onGigRequestCreated = onDocumentCreated(
  "gigRequests/{gigId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const db = getFirestore();
    let companyName = "Your company";
    try {
      const snap = await db.doc(`companies/${data.companyId}`).get();
      const c = snap.data();
      if (c?.name) companyName = c.name;
    } catch { /* proceed with default */ }

    const portalUrl =
      process.env.APP_URL
        ? `${process.env.APP_URL}/alumni-portal/gigs`
        : "https://offboardkit.com/alumni-portal/gigs";

    await sendEmailSafe({
      to: [{ email: data.alumniEmail, name: data.alumniName }],
      subject: `A consulting opportunity from ${companyName}`,
      htmlContent: buildGigRequestEmail({
        alumniName: data.alumniName,
        companyName,
        createdByName: data.createdByName,
        title: data.title,
        engagementType: data.engagementType,
        budget: fmtBudget(data.budgetMin ?? null, data.budgetMax ?? null),
        timelineWeeks: data.timelineWeeks ?? null,
        portalUrl,
      }),
    });
  }
);

export const onGigRequestResponded = onDocumentUpdated(
  "gigRequests/{gigId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    if (before.status !== "sent") return;
    if (after.status !== "accepted" && after.status !== "declined") return;

    const db = getFirestore();

    let hrEmail = "";
    let hrName = after.createdByName as string;
    try {
      const userSnap = await db.doc(`users/${after.createdBy}`).get();
      const u = userSnap.data();
      if (u?.email) hrEmail = u.email;
      if (u?.displayName) hrName = u.displayName;
    } catch { /* proceed without */ }

    if (!hrEmail) return;

    const poolUrl =
      process.env.APP_URL
        ? `${process.env.APP_URL}/alumni`
        : "https://offboardkit.com/alumni";

    const subject =
      after.status === "accepted"
        ? `${after.alumniName} accepted your gig request`
        : `${after.alumniName} declined your gig request`;

    await sendEmailSafe({
      to: [{ email: hrEmail, name: hrName }],
      subject,
      htmlContent: buildHrResponseEmail({
        hrName,
        alumniName: after.alumniName as string,
        alumniEmail: after.alumniEmail as string,
        title: after.title as string,
        status: after.status as "accepted" | "declined",
        alumniNote: (after.alumniNote as string | null) ?? null,
        poolUrl,
      }),
    });
  }
);
