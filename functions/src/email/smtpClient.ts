import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";

const smtpConfig = functions.config().smtp ?? {};

function configValue(envName: string, configName: string, fallback = ""): string {
  const envValue = process.env[envName];
  if (envValue) return envValue;

  const configuredValue = smtpConfig[configName];
  if (typeof configuredValue === "string" && configuredValue) {
    return configuredValue;
  }

  return fallback;
}

function booleanConfigValue(
  envName: string,
  configName: string,
  fallback: boolean
): boolean {
  const rawValue = configValue(envName, configName);
  if (!rawValue) return fallback;
  return rawValue === "true";
}

function createTransporter() {
  const port = Number(configValue("SMTP_PORT", "port", "465"));
  const secure = booleanConfigValue("SMTP_SECURE", "secure", port === 465);
  const user = configValue("SMTP_USER", "user", "hello@feedsolve.com");
  const pass = configValue("SMTP_PASSWORD", "password");

  if (!pass) {
    throw new Error(
      "SMTP password is not configured. Set SMTP_PASSWORD or firebase functions config smtp.password."
    );
  }

  return nodemailer.createTransport({
    host: configValue("SMTP_HOST", "host", "mail.spacemail.com"),
    port,
    secure,
    auth: { user, pass },
  });
}

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

export async function sendSmtpEmail(params: SendEmailParams): Promise<void> {
  const toAddresses = params.to
    .map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email))
    .join(", ");

  const smtpUser = configValue("SMTP_USER", "user", "hello@feedsolve.com");
  const sender = params.sender ?? {
    email: configValue("SMTP_FROM_EMAIL", "from_email", smtpUser),
    name: configValue("SMTP_FROM_NAME", "from_name", "OffboardKit"),
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
    await createTransporter().sendMail(mailOptions);
  } catch (error) {
    console.error("SMTP email error:", error);
    throw error;
  }
}
