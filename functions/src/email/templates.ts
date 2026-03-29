// ---------------------------------------------------------------------------
// OffboardKit Email Templates
// Table-based layout with inline CSS for Gmail/Outlook/Apple Mail compatibility.
// Brand: teal #0D9E8A | navy #0F1C2E | muted #6B7280 | warm bg #F5F0E8
// ---------------------------------------------------------------------------

const BRAND = {
  teal: "#0D9E8A",
  navy: "#0F1C2E",
  muted: "#6B7280",
  warmBg: "#F5F0E8",
  white: "#FFFFFF",
  red: "#DC2626",
  green: "#16A34A",
  gray: "#9CA3AF",
};

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;

function emailWrapper(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>OffboardKit</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.warmBg};font-family:${FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.warmBg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <!-- Card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${BRAND.white};border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header bar -->
          <tr>
            <td style="background-color:${BRAND.navy};padding:20px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family:${FONT};font-size:20px;font-weight:700;color:${BRAND.white};letter-spacing:-0.3px;">
                      Offboard<span style="color:${BRAND.teal};">Kit</span>
                    </span>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;width:28px;height:4px;background-color:${BRAND.teal};border-radius:2px;"></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 28px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #F3F4F6;">
              <p style="margin:0;font-family:${FONT};font-size:12px;color:${BRAND.muted};text-align:center;">
                Sent by <a href="https://offboardkit.com" style="color:${BRAND.teal};text-decoration:none;">OffboardKit</a> · You are receiving this because you are part of an offboarding process.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;">
    <tr>
      <td style="border-radius:6px;background-color:${BRAND.teal};">
        <a href="${url}" target="_blank"
           style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:${BRAND.white};text-decoration:none;border-radius:6px;line-height:1;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="border-top:1px solid #F3F4F6;"></td></tr>
  </table>`;
}

function metaRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-family:${FONT};font-size:13px;color:${BRAND.muted};width:160px;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;font-family:${FONT};font-size:13px;color:${BRAND.navy};font-weight:500;vertical-align:top;">${value}</td>
  </tr>`;
}

// ---------------------------------------------------------------------------
// 3a. Portal Link Email — sent to departing employee
// ---------------------------------------------------------------------------
export function portalLinkEmail(params: {
  employeeName: string;
  companyName: string;
  lastWorkingDay: string;
  portalUrl: string;
  hrContactName?: string;
}): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 8px;font-family:${FONT};font-size:24px;font-weight:700;color:${BRAND.navy};letter-spacing:-0.3px;">
      Your exit portal is ready
    </h1>
    <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;color:${BRAND.muted};line-height:1.5;">
      Hi ${params.employeeName},
    </p>
    <p style="margin:0 0 16px;font-family:${FONT};font-size:15px;color:${BRAND.navy};line-height:1.6;">
      ${params.companyName} has set up your offboarding portal to help make your transition as smooth as possible.
    </p>
    <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;color:${BRAND.navy};line-height:1.6;">
      Through your portal you can complete exit tasks, submit knowledge transfer notes, and fill out your exit interview — all in one place.
    </p>
    ${divider()}
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      ${metaRow("Your last day", params.lastWorkingDay)}
      ${params.hrContactName ? metaRow("HR contact", params.hrContactName) : ""}
    </table>
    ${ctaButton("Open My Exit Portal", params.portalUrl)}
    ${divider()}
    <p style="margin:0;font-family:${FONT};font-size:13px;color:${BRAND.muted};line-height:1.6;">
      You can return to this portal anytime before 7 days after your last day. The link above is unique to you — please don't share it.
    </p>
  `;

  return {
    subject: `Your exit portal is ready, ${params.employeeName}`,
    html: emailWrapper(body),
  };
}

// ---------------------------------------------------------------------------
// 3b. Offboarding Started — HR Team Notification
// ---------------------------------------------------------------------------
export function offboardingStartedEmail(params: {
  hrName: string;
  employeeName: string;
  employeeRole: string;
  department: string;
  lastWorkingDay: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 8px;font-family:${FONT};font-size:24px;font-weight:700;color:${BRAND.navy};letter-spacing:-0.3px;">
      Offboarding started
    </h1>
    <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;color:${BRAND.muted};line-height:1.5;">
      Hi ${params.hrName},
    </p>
    <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;color:${BRAND.navy};line-height:1.6;">
      A new offboarding process has been initiated. Here's a summary:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="background-color:#F9FAFB;border-radius:6px;padding:20px;">
      <tr><td style="padding:20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${metaRow("Employee", params.employeeName)}
          ${metaRow("Role", params.employeeRole)}
          ${metaRow("Department", params.department)}
          ${metaRow("Last working day", params.lastWorkingDay)}
        </table>
      </td></tr>
    </table>
    ${ctaButton("View Offboarding", params.dashboardUrl)}
    ${divider()}
    <p style="margin:0;font-family:${FONT};font-size:13px;color:${BRAND.muted};line-height:1.6;">
      You can track tasks, review knowledge transfers, and manage access revocation from the offboarding dashboard.
    </p>
  `;

  return {
    subject: `Offboarding started: ${params.employeeName}`,
    html: emailWrapper(body),
  };
}

// ---------------------------------------------------------------------------
// 3c. Task Assigned Notification
// ---------------------------------------------------------------------------
export function taskAssignedEmail(params: {
  assigneeName: string;
  employeeName: string;
  taskTitle: string;
  dueDate: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 8px;font-family:${FONT};font-size:24px;font-weight:700;color:${BRAND.navy};letter-spacing:-0.3px;">
      New task assigned
    </h1>
    <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;color:${BRAND.muted};line-height:1.5;">
      Hi ${params.assigneeName},
    </p>
    <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;color:${BRAND.navy};line-height:1.6;">
      You've been assigned a task as part of <strong>${params.employeeName}</strong>'s offboarding.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="background-color:#F9FAFB;border-radius:6px;">
      <tr><td style="padding:20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${metaRow("Task", params.taskTitle)}
          ${metaRow("Regarding", params.employeeName)}
          ${metaRow("Due date", params.dueDate)}
        </table>
      </td></tr>
    </table>
    ${ctaButton("View Task", params.dashboardUrl)}
    ${divider()}
    <p style="margin:0;font-family:${FONT};font-size:13px;color:${BRAND.muted};line-height:1.6;">
      Please complete this task before the due date. Contact your HR admin if you have questions.
    </p>
  `;

  return {
    subject: `Task assigned: ${params.taskTitle}`,
    html: emailWrapper(body),
  };
}

// ---------------------------------------------------------------------------
// 3d. Task Overdue Alert — sent to HR Admin
// ---------------------------------------------------------------------------
export function taskOverdueEmail(params: {
  hrName: string;
  employeeName: string;
  overdueTasks: { title: string; assigneeRole: string; dueDate: string }[];
  dashboardUrl: string;
}): { subject: string; html: string } {
  const taskRows = params.overdueTasks
    .map(
      (t) => `
      <tr>
        <td style="padding:10px 12px;font-family:${FONT};font-size:13px;color:${BRAND.navy};border-bottom:1px solid #F3F4F6;vertical-align:top;">
          ${t.title}
        </td>
        <td style="padding:10px 12px;font-family:${FONT};font-size:13px;color:${BRAND.muted};border-bottom:1px solid #F3F4F6;vertical-align:top;">
          ${t.assigneeRole}
        </td>
        <td style="padding:10px 12px;font-family:${FONT};font-size:13px;color:${BRAND.red};border-bottom:1px solid #F3F4F6;vertical-align:top;white-space:nowrap;">
          Due ${t.dueDate}
        </td>
      </tr>`
    )
    .join("");

  const count = params.overdueTasks.length;

  const body = `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td style="vertical-align:middle;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:${BRAND.red};margin-right:8px;vertical-align:middle;"></span>
          <h1 style="display:inline;margin:0;font-family:${FONT};font-size:22px;font-weight:700;color:${BRAND.navy};letter-spacing:-0.3px;vertical-align:middle;">
            Overdue tasks
          </h1>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;color:${BRAND.muted};line-height:1.5;">
      Hi ${params.hrName},
    </p>
    <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;color:${BRAND.navy};line-height:1.6;">
      <strong>${params.employeeName}</strong>'s offboarding has <strong>${count} overdue task${count > 1 ? "s" : ""}</strong> that require attention.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #E5E7EB;border-radius:6px;overflow:hidden;">
      <thead>
        <tr style="background-color:#F9FAFB;">
          <th style="padding:10px 12px;font-family:${FONT};font-size:12px;font-weight:600;color:${BRAND.muted};text-align:left;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Task</th>
          <th style="padding:10px 12px;font-family:${FONT};font-size:12px;font-weight:600;color:${BRAND.muted};text-align:left;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Assignee</th>
          <th style="padding:10px 12px;font-family:${FONT};font-size:12px;font-weight:600;color:${BRAND.muted};text-align:left;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E5E7EB;">Due Date</th>
        </tr>
      </thead>
      <tbody>
        ${taskRows}
      </tbody>
    </table>
    ${ctaButton("View Offboarding", params.dashboardUrl)}
    ${divider()}
    <p style="margin:0;font-family:${FONT};font-size:13px;color:${BRAND.muted};line-height:1.6;">
      This is an automated daily check. Overdue tasks may delay the offboarding completion.
    </p>
  `;

  return {
    subject: `⚠️ Overdue tasks: ${params.employeeName}'s offboarding`,
    html: emailWrapper(body),
  };
}

// ---------------------------------------------------------------------------
// 3e. Manager Knowledge Review Request
// ---------------------------------------------------------------------------
export function knowledgeReviewEmail(params: {
  managerName: string;
  employeeName: string;
  itemCount: number;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 8px;font-family:${FONT};font-size:24px;font-weight:700;color:${BRAND.navy};letter-spacing:-0.3px;">
      Knowledge review needed
    </h1>
    <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;color:${BRAND.muted};line-height:1.5;">
      Hi ${params.managerName},
    </p>
    <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;color:${BRAND.navy};line-height:1.6;">
      <strong>${params.employeeName}</strong> has submitted
      <strong>${params.itemCount} knowledge item${params.itemCount !== 1 ? "s" : ""}</strong> for your review.
      Please look these over to ensure a smooth handover before their last day.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="background-color:#F0FDF4;border-left:4px solid ${BRAND.teal};border-radius:0 6px 6px 0;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0;font-family:${FONT};font-size:14px;color:#166534;line-height:1.6;">
          <strong>${params.itemCount} item${params.itemCount !== 1 ? "s" : ""}</strong> ready for review
        </p>
      </td></tr>
    </table>
    ${ctaButton("Review Knowledge", params.dashboardUrl)}
    ${divider()}
    <p style="margin:0;font-family:${FONT};font-size:13px;color:${BRAND.muted};line-height:1.6;">
      Reviewing these items helps preserve institutional knowledge and ensures continuity for your team.
    </p>
  `;

  return {
    subject: `Knowledge review needed: ${params.employeeName}`,
    html: emailWrapper(body),
  };
}

// ---------------------------------------------------------------------------
// 3f. Exit Interview Submitted — sent to HR Admin
// ---------------------------------------------------------------------------
export function exitInterviewSubmittedEmail(params: {
  hrName: string;
  employeeName: string;
  sentiment: "positive" | "neutral" | "negative";
  dashboardUrl: string;
}): { subject: string; html: string } {
  const sentimentConfig = {
    positive: { color: BRAND.green, label: "Positive", dot: "#16A34A" },
    neutral: { color: BRAND.gray, label: "Neutral", dot: "#9CA3AF" },
    negative: { color: BRAND.red, label: "Negative", dot: "#DC2626" },
  }[params.sentiment];

  const body = `
    <h1 style="margin:0 0 8px;font-family:${FONT};font-size:24px;font-weight:700;color:${BRAND.navy};letter-spacing:-0.3px;">
      Exit interview submitted
    </h1>
    <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;color:${BRAND.muted};line-height:1.5;">
      Hi ${params.hrName},
    </p>
    <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;color:${BRAND.navy};line-height:1.6;">
      <strong>${params.employeeName}</strong> has completed their exit interview. Review their responses in the dashboard.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="background-color:#F9FAFB;border-radius:6px;">
      <tr><td style="padding:20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${metaRow("Employee", params.employeeName)}
          <tr>
            <td style="padding:6px 0;font-family:${FONT};font-size:13px;color:${BRAND.muted};width:160px;vertical-align:middle;">Sentiment</td>
            <td style="padding:6px 0;vertical-align:middle;">
              <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background-color:${sentimentConfig.dot};margin-right:6px;vertical-align:middle;"></span>
              <span style="font-family:${FONT};font-size:13px;font-weight:500;color:${sentimentConfig.color};vertical-align:middle;">${sentimentConfig.label}</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
    ${ctaButton("View Responses", params.dashboardUrl)}
    ${divider()}
    <p style="margin:0;font-family:${FONT};font-size:13px;color:${BRAND.muted};line-height:1.6;">
      Exit interview data is kept confidential and used only for internal HR reporting.
    </p>
  `;

  return {
    subject: `Exit interview submitted: ${params.employeeName}`,
    html: emailWrapper(body),
  };
}
