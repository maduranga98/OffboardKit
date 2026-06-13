import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendSmtpEmail } from "../email/smtpClient";

const APP_URL = process.env.APP_URL || "https://offboardset.com";

function inviteHtml(params: {
  name: string;
  companyName: string;
  setupPasswordUrl: string;
}): string {
  const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:${FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="background:#0F1C2E;padding:20px 32px;">
          <span style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.3px;font-family:${FONT};">
            Offboard<span style="color:#0D9E8A;">Set</span>
          </span>
        </td></tr>
        <tr><td style="padding:36px 32px 28px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0F1C2E;letter-spacing:-0.3px;font-family:${FONT};">
            Welcome to the ${params.companyName} alumni network
          </h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#374151;font-family:${FONT};">
            Hi ${params.name},
          </p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;font-family:${FONT};">
            You've been added to the <strong>${params.companyName}</strong> alumni network on OffboardSet.
            You can update your profile, share your current role, and stay in touch about future opportunities.
          </p>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#374151;font-family:${FONT};">
            Click the button below to set your password and access the alumni portal.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td style="border-radius:6px;background:#0D9E8A;">
              <a href="${params.setupPasswordUrl}"
                 style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:6px;line-height:1;">
                Set Your Password
              </a>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6B7280;font-family:${FONT};">
            This link expires in 24 hours. If you weren't expecting this email, you can safely ignore it.
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #F3F4F6;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;font-family:${FONT};">
            Sent by <a href="https://offboardset.com" style="color:#0D9E8A;text-decoration:none;">OffboardSet</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export const sendAlumniInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }

  const { profileId } = data as { profileId?: string };
  if (!profileId || typeof profileId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "profileId required");
  }

  const db = admin.firestore();

  const profileDoc = await db.collection("alumniProfiles").doc(profileId).get();
  if (!profileDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Alumni profile not found");
  }

  const profile = profileDoc.data()!;

  // Verify caller belongs to the same company
  const callerDoc = await db.collection("users").doc(context.auth.uid).get();
  const caller = callerDoc.data();
  if (!caller || caller.companyId !== profile.companyId) {
    throw new functions.https.HttpsError("permission-denied", "Not authorized");
  }

  const email = profile.email as string;
  if (!email) {
    throw new functions.https.HttpsError("invalid-argument", "Alumni has no email address");
  }

  // Look up company name
  let companyName = "your company";
  try {
    const companyDoc = await db.collection("companies").doc(profile.companyId as string).get();
    companyName = (companyDoc.data()?.name as string) || "your company";
  } catch {
    // Use fallback
  }

  // Generate a password-setup link so the alumni can set their own password
  let setupPasswordUrl: string;
  try {
    setupPasswordUrl = await admin.auth().generatePasswordResetLink(email, {
      url: `${APP_URL}/alumni-login`,
    });
  } catch {
    setupPasswordUrl = `${APP_URL}/alumni-login`;
  }

  await sendSmtpEmail({
    to: [{ email, name: (profile.name as string) || undefined }],
    subject: `You've been invited to the ${companyName} alumni network`,
    htmlContent: inviteHtml({
      name: (profile.name as string) || "there",
      companyName,
      setupPasswordUrl,
    }),
  });

  await profileDoc.ref.update({ invitationSentAt: admin.firestore.FieldValue.serverTimestamp() });

  console.log(`Alumni invite sent to ${email}`);
  return { success: true };
});
