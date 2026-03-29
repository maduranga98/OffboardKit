import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendBrevoEmail } from "../email/brevoClient";

const ROLE_LABELS: Record<string, string> = {
  hr_admin: "HR Admin",
  it_admin: "IT Admin",
  manager: "Manager",
  super_admin: "Super Admin",
};

export const sendTeamInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }

  const { inviteId } = data;
  if (!inviteId || typeof inviteId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "inviteId required");
  }

  const db = admin.firestore();

  const inviteDoc = await db.collection("invites").doc(inviteId).get();
  if (!inviteDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Invite not found");
  }

  const invite = inviteDoc.data()!;

  const callerDoc = await db.collection("users").doc(context.auth.uid).get();
  const caller = callerDoc.data();
  if (!caller || caller.companyId !== invite.companyId) {
    throw new functions.https.HttpsError("permission-denied", "Not authorized");
  }

  const appUrl = process.env.APP_URL || "https://offboardkit.com";
  const signupUrl = `${appUrl}/signup?invite=${inviteId}`;
  const roleLabel = ROLE_LABELS[invite.role] || invite.role;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F0E8;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:12px;overflow:hidden;">
        <tr><td style="height:4px;background-color:#0D9E8A;"></td></tr>
        <tr><td style="padding:32px 40px 0;">
          <span style="font-size:20px;font-weight:700;color:#0F1C2E;">OffboardKit</span>
        </td></tr>
        <tr><td style="padding:24px 40px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#0F1C2E;">
            You're invited to join ${invite.companyName}
          </h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#374151;">
            ${invite.invitedByName} has invited you to join <strong>${invite.companyName}</strong> on OffboardKit as <strong>${roleLabel}</strong>.
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
            OffboardKit helps your team manage employee offboarding — from task tracking to knowledge transfer to exit interviews.
          </p>
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${signupUrl}" style="display:inline-block;background-color:#0D9E8A;color:#FFFFFF;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600;text-decoration:none;">
              Accept Invite &amp; Sign Up
            </a>
          </td></tr></table>
          <p style="margin:20px 0 0;font-size:13px;color:#6B7280;">
            This invite expires in 7 days. If the button doesn't work, copy and paste this link:
          </p>
          <p style="margin:4px 0 0;font-size:13px;color:#0D9E8A;word-break:break-all;">
            ${signupUrl}
          </p>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;">
            Sent by OffboardKit &middot; <a href="https://offboardkit.com" style="color:#0D9E8A;text-decoration:none;">offboardkit.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendBrevoEmail({
    to: [{ email: invite.email }],
    subject: `${invite.invitedByName} invited you to join ${invite.companyName} on OffboardKit`,
    htmlContent: html,
  });

  console.log(`Invite email sent to ${invite.email} for company ${invite.companyName}`);
  return { success: true };
});
