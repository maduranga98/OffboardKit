import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendSmtpEmail } from "../email/smtpClient";

const APP_URL = process.env.APP_URL || "https://offboardset.com";

function inviteHtml(params: {
  name: string;
  companyName: string;
  loginUrl: string;
}): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
        <tr><td style="height:4px;background:#0D9E8A;"></td></tr>
        <tr><td style="padding:32px 40px 0;">
          <span style="font-size:20px;font-weight:700;color:#0F1C2E;">Offboard<span style="color:#0D9E8A;">Set</span></span>
        </td></tr>
        <tr><td style="padding:24px 40px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#0F1C2E;">
            Welcome to the ${params.companyName} alumni network
          </h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#374151;">
            Hi ${params.name},
          </p>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#374151;">
            You've been added to the <strong>${params.companyName}</strong> alumni network on OffboardSet.
            You can update your profile, share your current role, and stay in touch about future opportunities.
          </p>
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${params.loginUrl}" style="display:inline-block;background:#0D9E8A;color:#fff;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600;text-decoration:none;">
              Open Alumni Portal
            </a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;">
            Sent by OffboardSet &middot; <a href="https://offboardset.com" style="color:#0D9E8A;text-decoration:none;">offboardset.com</a>
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
    const loginUrl = `${APP_URL}/alumni-login`;

    try {
      await sendSmtpEmail({
        to: [{ email }],
        subject: `Welcome to the ${companyName} alumni network`,
        htmlContent: inviteHtml({
          name: (after.name as string) || "there",
          companyName,
          loginUrl,
        }),
      });
      await change.after.ref.update({
        invitationSentAt: new Date(),
      });
    } catch (err) {
      console.error("onAlumniOptedIn email failed", err);
    }
  });
