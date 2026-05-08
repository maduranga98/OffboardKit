/**
 * Thin wrapper around sendSmtpEmail that swallows errors so a single
 * failed send doesn't abort an entire trigger that may be sending to
 * multiple recipients.
 */
import { sendSmtpEmail, SendEmailParams } from "./smtpClient";

export async function sendEmailSafe(params: SendEmailParams): Promise<void> {
  try {
    await sendSmtpEmail(params);
  } catch (error) {
    // Log but don't rethrow — other emails in the same trigger should still send.
    console.error(
      `Failed to send email "${params.subject}" to ${params.to.map((r) => r.email).join(", ")}:`,
      error
    );
  }
}
