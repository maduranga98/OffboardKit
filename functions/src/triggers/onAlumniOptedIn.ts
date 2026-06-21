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
        <!-- Header -->
        <tr><td style="background:#0F1C2E;padding:20px 32px;">
          <span style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.3px;font-family:${FONT};">
            Offboard<span style="color:#0D9E8A;">Set</span>
          </span>
        </td></tr>
        <!-- Body -->
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
          <!-- CTA -->
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
        <!-- Footer -->
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #F3F4F6;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;font-family:${FONT};">
            Sent by OffboardSet
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export const onAlumniOptedIn = functions.firestore
  .document("alumniProfiles/{profileId}")
  .onWrite(async (change) => {
    const after = change.after.exists ? change.after.data() : null;
    if (!after) return;

    const before = change.before.exists ? change.before.data() : null;
    const wasOptedIn = Boolean(before?.optedIn);
    const isOptedIn = Boolean(after.optedIn);
    if (!isOptedIn || wasOptedIn) return;
    if (after.invitationSentAt) return;

    const email = after.email as string | undefined;
    if (!email) return;

    let companyName = (after.companyName as string) || "";
    if (!companyName && after.companyId) {
      try {
        const companyDoc = await admin
          .firestore()
          .collection("companies")
          .doc(after.companyId as string)
          .get();
        companyName = (companyDoc.data()?.name as string) || "your company";
      } catch {
        companyName = "your company";
      }
    }
    if (!companyName) companyName = "your company";

    // Generate a password-setup link via the Admin SDK so the alumni can
    // set their own password directly from the email.
    let setupPasswordUrl: string;
    try {
      setupPasswordUrl = await admin.auth().generatePasswordResetLink(email, {
        url: `${APP_URL}/alumni-login?companyId=${after.companyId}`,
      });
    } catch (err) {
      console.error("onAlumniOptedIn: failed to generate password reset link", err);
      setupPasswordUrl = `${APP_URL}/alumni-login${after.companyId ? `?companyId=${after.companyId}` : ""}`;
    }

    try {
      await sendSmtpEmail({
        to: [{ email, name: (after.name as string) || undefined }],
        subject: `You've been invited to the ${companyName} alumni network`,
        htmlContent: inviteHtml({
          name: (after.name as string) || "there",
          companyName,
          setupPasswordUrl,
        }),
      });
      await change.after.ref.update({
        invitationSentAt: new Date(),
      });
    } catch (err) {
      console.error("onAlumniOptedIn email failed", err);
    }
  });
