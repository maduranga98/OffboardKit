import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { sendSmtpEmail } from "../email/smtpClient";

const APP_URL = process.env.APP_URL || "https://offboardset.com";

interface AlumniProfile {
  id: string;
  name: string;
  email: string;
  optedIn: boolean;
  companyId: string;
}

interface PulseSurveyQuestion {
  id: string;
  text: string;
  type: string;
  order: number;
}

interface PulseSurvey {
  id: string;
  companyId: string;
  name: string;
  schedule: "manual" | "quarterly" | "biannual" | "monthly";
  questions: PulseSurveyQuestion[];
  totalSent: number;
  totalResponded: number;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function computeNextSendAt(schedule: PulseSurvey["schedule"], from: Date): admin.firestore.Timestamp | null {
  if (schedule === "manual") return null;
  if (schedule === "monthly") return admin.firestore.Timestamp.fromDate(addMonths(from, 1));
  if (schedule === "quarterly") return admin.firestore.Timestamp.fromDate(addMonths(from, 3));
  if (schedule === "biannual") return admin.firestore.Timestamp.fromDate(addMonths(from, 6));
  return null;
}

function surveyEmailHtml(params: {
  name: string;
  companyName: string;
  surveyUrl: string;
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
            Offboard<span style="color:#0D9E8A;">Kit</span>
          </span>
        </td></tr>
        <tr><td style="padding:36px 32px 28px;">
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#374151;font-family:${FONT};">
            Hi ${params.name},
          </p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;font-family:${FONT};">
            <strong>${params.companyName}</strong> would love to hear how you're doing.
            This takes under 30 seconds — just 3 quick questions.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td style="border-radius:6px;background:#0D9E8A;">
              <a href="${params.surveyUrl}"
                 style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:6px;line-height:1;">
                Take the Survey
              </a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#6B7280;font-family:${FONT};">
            — The ${params.companyName} Team
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

export const sendPulseSurvey = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const { companyId, surveyId } = request.data as { companyId?: string; surveyId?: string };

  if (!companyId || typeof companyId !== "string") {
    throw new HttpsError("invalid-argument", "companyId required");
  }
  if (!surveyId || typeof surveyId !== "string") {
    throw new HttpsError("invalid-argument", "surveyId required");
  }

  const db = admin.firestore();

  // Fetch survey
  const surveyDoc = await db.collection("pulseSurveys").doc(surveyId).get();
  if (!surveyDoc.exists) {
    throw new HttpsError("not-found", "Survey not found");
  }
  const survey = { id: surveyDoc.id, ...surveyDoc.data() } as PulseSurvey;

  if (survey.companyId !== companyId) {
    throw new HttpsError("permission-denied", "Not authorized");
  }

  // Fetch company name
  let companyName = "your company";
  try {
    const companyDoc = await db.collection("companies").doc(companyId).get();
    companyName = (companyDoc.data()?.name as string) || "your company";
  } catch {
    // Use fallback
  }

  // Fetch opted-in alumni
  const alumniSnap = await db
    .collection("alumniProfiles")
    .where("companyId", "==", companyId)
    .where("optedIn", "==", true)
    .get();

  const alumniList: AlumniProfile[] = alumniSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  } as AlumniProfile));

  if (alumniList.length === 0) {
    return { sent: 0 };
  }

  // Replace [Company] in question texts
  const processedQuestions = survey.questions.map((q) => ({
    ...q,
    text: q.text.replace(/\[Company\]/g, companyName),
  }));

  // Send in chunks of 10
  const CHUNK_SIZE = 10;
  let sentCount = 0;

  for (let i = 0; i < alumniList.length; i += CHUNK_SIZE) {
    const chunk = alumniList.slice(i, i + CHUNK_SIZE);

    await Promise.all(
      chunk.map(async (alumni) => {
        const token = require("crypto").randomUUID() as string;
        const responseId = require("crypto").randomUUID() as string;

        // Create pulse response document
        await db.collection("pulseResponses").doc(responseId).set({
          id: responseId,
          companyId,
          surveyId,
          alumniId: alumni.id,
          alumniName: alumni.name,
          alumniEmail: alumni.email,
          token,
          status: "sent",
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          completedAt: null,
          responses: {},
          satisfactionScore: null,
          wouldReturn: null,
          wouldRefer: null,
        });

        // Send email
        const surveyUrl = `${APP_URL}/survey/${token}`;
        await sendSmtpEmail({
          to: [{ email: alumni.email, name: alumni.name }],
          subject: `${companyName} Alumni — Quick ${processedQuestions.length}-Question Survey`,
          htmlContent: surveyEmailHtml({
            name: alumni.name || "there",
            companyName,
            surveyUrl,
          }),
        });

        sentCount++;
      })
    );

    // 500ms delay between chunks (skip delay after last chunk)
    if (i + CHUNK_SIZE < alumniList.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Update survey metadata
  const nextSendAt = computeNextSendAt(survey.schedule, new Date());
  await db.collection("pulseSurveys").doc(surveyId).update({
    lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
    totalSent: admin.firestore.FieldValue.increment(sentCount),
    nextSendAt,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Pulse survey ${surveyId} sent to ${sentCount} alumni`);
  return { sent: sentCount };
});
