import * as nodemailer from "nodemailer";

// Brevo SMTP relay — login is the Brevo SMTP username, NOT the sender address.
// Get the password from: Brevo dashboard → Settings → SMTP & API → SMTP tab → Password
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: "a67446001@smtp-brevo.com",
    pass: process.env.BREVO_SMTP_KEY || "",
  },
});

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailParams {
  to: EmailRecipient[];
  subject: string;
  htmlContent: string;
  sender?: { email: string; name: string };
  replyTo?: { email: string; name: string };
}

export async function sendBrevoEmail(params: SendEmailParams): Promise<void> {
  const toAddresses = params.to
    .map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email))
    .join(", ");

  const sender = params.sender ?? {
    email: "notifications@offboardkit.com",
    name: "OffboardKit",
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

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("SMTP email error:", error);
    throw error;
  }
}
