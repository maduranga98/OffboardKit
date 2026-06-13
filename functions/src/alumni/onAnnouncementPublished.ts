import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { sendEmailSafe } from "../email/sendEmail";
import { emailWrapper, ctaButton, divider } from "../email/templates";

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
const NAVY = "#0F1C2E";
const TEAL = "#0D9E8A";
const MUTED = "#6B7280";

const TYPE_LABELS: Record<string, string> = {
  news:      "📢 Company News",
  roles:     "💼 Open Roles",
  milestone: "🎉 Milestone",
  event:     "📅 Event",
};

function buildAnnouncementEmail(params: {
  alumniName: string;
  companyName: string;
  typeLabel: string;
  title: string;
  contentPreview: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  eventDate?: string | null;
  eventLocation?: string | null;
  portalUrl: string;
}): string {
  const eventBlock =
    params.eventDate || params.eventLocation
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background-color:#F0FEF9;border-radius:6px;">
          <tr><td style="padding:14px 16px;">
            ${params.eventDate ? `<p style="margin:0 0 4px;font-family:${FONT};font-size:14px;font-weight:600;color:${NAVY};">📅 ${params.eventDate}</p>` : ""}
            ${params.eventLocation ? `<p style="margin:0;font-family:${FONT};font-size:13px;color:${MUTED};">📍 ${params.eventLocation}</p>` : ""}
          </td></tr>
        </table>`
      : "";

  const ctaBlock =
    params.ctaLabel && params.ctaUrl
      ? ctaButton(params.ctaLabel, params.ctaUrl)
      : "";

  const body = `
    <p style="margin:0 0 4px;font-family:${FONT};font-size:12px;font-weight:600;color:${TEAL};text-transform:uppercase;letter-spacing:0.05em;">
      ${params.typeLabel} from ${params.companyName}
    </p>
    <h1 style="margin:0 0 12px;font-family:${FONT};font-size:22px;font-weight:700;color:${NAVY};letter-spacing:-0.3px;">
      ${params.title}
    </h1>
    <p style="margin:0 0 20px;font-family:${FONT};font-size:15px;color:${MUTED};line-height:1.5;">
      Hi ${params.alumniName},
    </p>
    <p style="margin:0 0 20px;font-family:${FONT};font-size:15px;color:${NAVY};line-height:1.6;">
      ${params.contentPreview}
    </p>
    ${eventBlock}
    ${ctaBlock}
    ${divider()}
    <p style="margin:0 0 12px;font-family:${FONT};font-size:13px;color:${MUTED};line-height:1.6;">
      Log in to your alumni portal to see the full update.
    </p>
    ${ctaButton("Open Alumni Portal", params.portalUrl)}
    ${divider()}
    <p style="margin:0;font-family:${FONT};font-size:12px;color:${MUTED};line-height:1.6;">
      You're receiving this as a member of ${params.companyName}'s alumni network.
    </p>
  `;
  return emailWrapper(body);
}

export const onAnnouncementPublished = onDocumentUpdated(
  "alumniAnnouncements/{announcementId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // Only trigger when status changes to published
    if (before.status === "published" || after.status !== "published") return;

    const db = getFirestore();

    // Fetch company name
    let companyName = "Your company";
    try {
      const companySnap = await db.doc(`companies/${after.companyId}`).get();
      const companyData = companySnap.data();
      if (companyData?.name) companyName = companyData.name;
    } catch {
      // proceed with default
    }

    // Fetch alumni to notify
    let alumniQuery = db
      .collection("alumniProfiles")
      .where("companyId", "==", after.companyId)
      .where("optedIn", "==", true);

    const alumniSnap = await alumniQuery.get();
    const allOptedIn = alumniSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
      id: string;
      email: string;
      name: string;
      optedIn: boolean;
    }>;

    // If audience === 'all', we should also include non-opted-in alumni with emails
    // but the spec says we fetch optedIn == true first, then if 'all' include non-opted-in too
    let recipients = allOptedIn;

    if (after.audience === "all") {
      const nonOptedSnap = await db
        .collection("alumniProfiles")
        .where("companyId", "==", after.companyId)
        .where("optedIn", "==", false)
        .get();
      const nonOptedIn = nonOptedSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as typeof recipients;
      recipients = [...allOptedIn, ...nonOptedIn];
    }

    const withEmail = recipients.filter((a) => a.email);
    const portalUrl =
      process.env.APP_URL
        ? `${process.env.APP_URL}/alumni-portal/updates`
        : "https://offboardkit.com/alumni-portal/updates";

    const typeLabel = TYPE_LABELS[after.type] ?? "Update";
    const contentPreview =
      after.content.length > 300
        ? after.content.slice(0, 300) + "…"
        : after.content;

    let eventDateStr: string | null = null;
    if (after.type === "event" && after.eventDate) {
      try {
        const d = after.eventDate.toDate ? after.eventDate.toDate() : new Date(after.eventDate);
        eventDateStr = d.toLocaleString("en-US", {
          month: "short", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit",
        });
      } catch { /* ignore */ }
    }

    // Cap at 500 per invocation
    const capped = withEmail.slice(0, 500);

    for (const alumni of capped) {
      await sendEmailSafe({
        to: [{ email: alumni.email, name: alumni.name }],
        subject: `[${companyName}] ${after.title}`,
        htmlContent: buildAnnouncementEmail({
          alumniName: alumni.name,
          companyName,
          typeLabel,
          title: after.title,
          contentPreview,
          ctaLabel: after.ctaLabel ?? null,
          ctaUrl: after.ctaUrl ?? null,
          eventDate: eventDateStr,
          eventLocation: after.eventLocation ?? null,
          portalUrl,
        }),
      });
    }
  }
);
