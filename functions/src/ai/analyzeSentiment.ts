import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateJSON } from "./geminiClient";

interface SentimentResult {
  sentimentScore: number;
  sentimentLabel: "positive" | "neutral" | "negative";
  keyThemes: string[];
  summary: string;
  riskFlags: string[];
  recommendedActions: string[];
}

export const analyzeSentiment = functions.firestore
  .document("exitInterviewResponses/{responseId}")
  .onCreate(async (snapshot, context) => {
    const responseId = context.params.responseId;
    const data = snapshot.data();
    const db = admin.firestore();

    const answersText = (data.answers || [])
      .map((a: { questionText: string; type: string; value: string | number }) => {
        if (a.type === "rating") {
          return `Q: ${a.questionText}\nA: ${a.value}/5 stars`;
        }
        if (a.type === "yes_no") {
          return `Q: ${a.questionText}\nA: ${a.value === "yes" || (a.value as unknown) === true ? "Yes" : "No"}`;
        }
        if (a.type === "multiple_choice") {
          return `Q: ${a.questionText}\nA: ${a.value}`;
        }
        return `Q: ${a.questionText}\nA: ${a.value || "(no answer)"}`;
      })
      .join("\n\n");

    const prompt = `You are an HR analytics AI analyzing an exit interview for an employee leaving a company.

Employee: ${data.employeeName}
Role: ${data.employeeRole}
Department: ${data.employeeDepartment}

Exit Interview Responses:
${answersText}

Analyze these responses and return a JSON object with exactly this structure:
{
  "sentimentScore": <number from -1.0 (very negative) to 1.0 (very positive)>,
  "sentimentLabel": <"positive" | "neutral" | "negative">,
  "keyThemes": [<3 to 5 short theme strings extracted from the answers, e.g. "management concerns", "career growth", "positive team culture">],
  "summary": "<2-3 sentence summary of the employee's overall feedback and feelings about the company>",
  "riskFlags": [<any concerning patterns like mentions of harassment, discrimination, legal threats, safety issues — empty array if none>],
  "recommendedActions": [<2-3 specific actionable suggestions for HR based on this feedback>]
}

Rules:
- sentimentLabel must be "positive" if sentimentScore > 0.25, "negative" if < -0.25, "neutral" otherwise
- keyThemes should be specific to THIS interview, not generic
- summary should be factual and objective, not emotional
- riskFlags should only contain genuinely concerning items, not minor complaints
- recommendedActions should be practical and specific
- If the employee gave mostly short/empty answers, note that in the summary and suggest follow-up`;

    try {
      const result = await generateJSON<SentimentResult>(prompt);

      const sentimentScore = Math.max(-1, Math.min(1, Number(result.sentimentScore) || 0));
      const sentimentLabel = (["positive", "neutral", "negative"].includes(result.sentimentLabel))
        ? result.sentimentLabel
        : (sentimentScore > 0.25 ? "positive" : sentimentScore < -0.25 ? "negative" : "neutral");

      await db.collection("exitInterviewResponses").doc(responseId).update({
        sentimentScore,
        sentimentLabel,
        keyThemes: Array.isArray(result.keyThemes) ? result.keyThemes.slice(0, 5) : [],
        aiSummary: typeof result.summary === "string" ? result.summary : "",
        riskFlags: Array.isArray(result.riskFlags) ? result.riskFlags : [],
        recommendedActions: Array.isArray(result.recommendedActions) ? result.recommendedActions.slice(0, 3) : [],
        aiAnalyzedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (result.riskFlags && result.riskFlags.length > 0) {
        const hrUsers = await db
          .collection("users")
          .where("companyId", "==", data.companyId)
          .where("role", "in", ["hr_admin", "super_admin"])
          .get();

        for (const hrDoc of hrUsers.docs) {
          const notifId = db.collection("notifications").doc().id;
          await db.collection("notifications").doc(notifId).set({
            id: notifId,
            companyId: data.companyId,
            userId: hrDoc.id,
            type: "risk_flag",
            title: `Risk flag: ${data.employeeName}'s exit interview`,
            message: result.riskFlags.join(", "),
            link: `/interviews`,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      console.log(`AI sentiment analysis completed for response ${responseId}: ${sentimentLabel} (${sentimentScore})`);
    } catch (error) {
      console.error(`AI sentiment analysis failed for response ${responseId}:`, error);
      await db.collection("exitInterviewResponses").doc(responseId).update({
        aiAnalysisError: true,
        aiAnalyzedAt: null,
      });
    }
  });
