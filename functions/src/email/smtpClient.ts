import * as nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT || "465");
const smtpSecure =
  process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === "true"
    : smtpPort === 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "mail.spacemail.com",
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: process.env.SMTP_USER || "hello@feedsolve.com",
    pass: process.env.SMTP_PASSWORD || "",
  },
});

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  // Base64-encoded content.
  content: string;
  name: string;
  contentType?: string;
}

export interface SendEmailParams {
  to: EmailRecipient[];
  subject: string;
  htmlContent: string;
  sender?: { email: string; name: string };
  replyTo?: { email: string; name: string };
  attachments?: EmailAttachment[];
}

export async function sendSmtpEmail(params: SendEmailParams): Promise<void> {
  const toAddresses = params.to
    .map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email))
    .join(", ");

  const sender = params.sender ?? {
    email: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "hello@feedsolve.com",
    name: process.env.SMTP_FROM_NAME || "OffboardKit",
  };

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${sender.name}" <${sender.email}>`,
    to: toAddresses,
    subject: params.subject,
    html: params.htmlContent,
  };

  if (params.replyTo) {
    mailOptions.replyTo = `"${params.replyTo.name}" <${params.replyTo.email}>`;
  }

  if (params.attachments && params.attachments.length > 0) {
    mailOptions.attachments = params.attachments.map((a) => ({
      filename: a.name,
      content: a.content,
      encoding: "base64",
      contentType: a.contentType,
    }));
  }

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log("SMTP accepted:", result.response);
    console.log("SMTP envelope:", JSON.stringify(result.envelope));
    console.log("SMTP messageId:", result.messageId);
  } catch (error) {
    console.error("SMTP email error:", error);
    throw error;
  }
}
