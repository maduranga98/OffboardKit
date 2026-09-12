const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Invitation email sent when an alumni joins a company's network. */
export function alumniInviteHtml(params: {
  name: string;
  email: string;
  companyName: string;
  setupPasswordUrl: string;
}): string {
  const name = escapeHtml(params.name);
  const email = escapeHtml(params.email);
  const companyName = escapeHtml(params.companyName);
  const url = escapeHtml(params.setupPasswordUrl);

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
            Welcome to the ${companyName} alumni network
          </h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#374151;font-family:${FONT};">
            Hi ${name},
          </p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;font-family:${FONT};">
            You've been added to the <strong>${companyName}</strong> alumni network on OffboardSet.
            You can update your profile, share your current role, and stay in touch about future opportunities.
          </p>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#374151;font-family:${FONT};">
            Your account is already set up for <strong>${email}</strong> — just choose a password to finish.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td style="border-radius:6px;background:#0D9E8A;">
              <a href="${url}"
                 style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:6px;line-height:1;">
                Set Your Password
              </a>
            </td></tr>
          </table>
          <p style="margin:24px 0 8px;font-size:13px;line-height:1.6;color:#6B7280;font-family:${FONT};">
            Or paste this link into your browser:
          </p>
          <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;font-family:${FONT};">
            <a href="${url}" style="color:#0D9E8A;text-decoration:none;">${url}</a>
          </p>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6B7280;font-family:${FONT};">
            This link expires in 24 hours. If it does, you can request a new one from the
            alumni sign-in page. If you weren't expecting this email, you can safely ignore it.
          </p>
        </td></tr>
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
