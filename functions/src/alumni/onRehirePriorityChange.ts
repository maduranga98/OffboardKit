import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { sendEmailSafe } from "../email/sendEmail";
import { emailWrapper, ctaButton, divider } from "../email/templates";

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
const NAVY = "#0F1C2E";
const MUTED = "#6B7280";

function buildBoomerangEmail(params: {
  name: string;
  companyName: string;
  portalUrl: string;
}): string {
  const body = `
    <h1 style="margin:0 0 8px;font-family:${FONT};font-size:24px;font-weight:700;color:${NAVY};letter-spacing:-0.3px;">
      An opportunity from ${params.companyName}
    </h1>
    <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;color:${MUTED};line-height:1.5;">
      Hi ${params.name},
    </p>
    <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;color:${NAVY};line-height:1.6;">
      ${params.companyName} has flagged you as a potential candidate for future opportunities.
      Log in to your alumni portal to let them know if you're interested in reconnecting.
    </p>
    ${ctaButton("Open Alumni Portal", params.portalUrl)}
    ${divider()}
    <p style="margin:0;font-family:${FONT};font-size:13px;color:${MUTED};line-height:1.6;">
      You're receiving this because you're part of ${params.companyName}'s alumni network.
      This is not a job offer.
    </p>
  `;
  return emailWrapper(body);
}

export const onAlumniRehirePriorityChange = onDocumentUpdated(
  "alumniProfiles/{alumniId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const priorityChanged = before.rehirePriority !== after.rehirePriority;
    const isHighOrMedium =
      after.rehirePriority === "high" || after.rehirePriority === "medium";

    if (!priorityChanged || !isHighOrMedium) return;

    const db = getFirestore();

    // Fetch company name
    let companyName = "Your former company";
    if (after.companyId) {
      try {
        const companySnap = await db.doc(`companies/${after.companyId}`).get();
        const companyData = companySnap.data();
        if (companyData?.name) companyName = companyData.name;
      } catch {
        // proceed with default
      }
    }

    const portalUrl =
      process.env.APP_URL
        ? `${process.env.APP_URL}/alumni-portal/profile`
        : "https://offboardkit.com/alumni-portal/profile";

    // Send email
    await sendEmailSafe({
      to: [{ email: after.email, name: after.name }],
      subject: `An opportunity from ${companyName}`,
      htmlContent: buildBoomerangEmail({
        name: after.name,
        companyName,
        portalUrl,
      }),
    });

    // Set boomerangStage to 'potential' if it was none/unset
    const currentStage = after.boomerangStage;
    if (!currentStage || currentStage === "none") {
      await event.data!.after.ref.update({
        boomerangStage: "potential",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
);
