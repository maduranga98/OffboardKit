import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateJSON } from "./geminiClient";

interface KnowledgeGapResult {
  completenessScore: number;
  gaps: {
    area: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    suggestedPrompt: string;
  }[];
  strengths: string[];
  overallAssessment: string;
}

export const detectKnowledgeGaps = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }

  const { flowId } = data;
  if (!flowId || typeof flowId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "flowId required");
  }

  const db = admin.firestore();

  const flowDoc = await db.collection("offboardFlows").doc(flowId).get();
  if (!flowDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Offboarding flow not found");
  }
  const flow = flowDoc.data()!;

  const callerDoc = await db.collection("users").doc(context.auth.uid).get();
  const caller = callerDoc.data();
  if (!caller || caller.companyId !== flow.companyId) {
    throw new functions.https.HttpsError("permission-denied", "Not authorized");
  }

  const knowledgeItems = await db
    .collection("knowledgeItems")
    .where("flowId", "==", flowId)
    .get();

  const itemsList = knowledgeItems.docs.map((doc) => {
    const d = doc.data();
    return {
      title: d.title || "",
      type: d.type || "",
      description: d.description || "",
      url: d.url || "",
      successor: d.successor || "",
      status: d.status || "",
    };
  });

  const tasks = await db
    .collection("flowTasks")
    .where("flowId", "==", flowId)
    .get();

  const tasksList = tasks.docs.map((doc) => {
    const d = doc.data();
    return {
      title: d.title || "",
      assigneeRole: d.assigneeRole || "",
      status: d.status || "",
    };
  });

  const prompt = `You are an HR knowledge management AI. Analyze the knowledge transfer completeness for a departing employee.

Employee: ${flow.employeeName}
Role: ${flow.employeeRole}
Department: ${flow.employeeDepartment}

Knowledge Items Submitted (${itemsList.length} items):
${itemsList.length === 0
    ? "(No knowledge items have been submitted yet)"
    : itemsList.map((item, i) =>
        `${i + 1}. [${item.type}] "${item.title}" — ${item.description || "(no description)"} ${item.successor ? `(for: ${item.successor})` : ""}`
      ).join("\n")
}

Offboarding Tasks (${tasksList.length} tasks):
${tasksList.map((t) => `- ${t.title} (${t.assigneeRole}) — ${t.status}`).join("\n")}

Based on the employee's role (${flow.employeeRole}) and department (${flow.employeeDepartment}), analyze what knowledge transfer items would typically be expected and identify gaps.

Return a JSON object with exactly this structure:
{
  "completenessScore": <0-100 score of how complete the knowledge transfer is>,
  "gaps": [
    {
      "area": "<specific area that's missing, e.g. 'Client account handover'>",
      "severity": "<critical | high | medium | low>",
      "description": "<what's missing and why it matters>",
      "suggestedPrompt": "<a specific question to ask the employee to fill this gap>"
    }
  ],
  "strengths": [<1-3 things that are well-documented>],
  "overallAssessment": "<2-3 sentence assessment of the knowledge transfer status>"
}

Rules:
- Tailor gaps to the SPECIFIC role and department — a software engineer needs code documentation, a sales rep needs client handover notes, a manager needs team delegation plans
- severity "critical" = would cause immediate operational problems if not addressed
- severity "high" = significant knowledge loss but workaround exists
- severity "medium" = nice to have, reduces onboarding time for replacement
- severity "low" = minor, optional
- suggestedPrompt should be a specific, answerable question (not vague like "document everything")
- If no items have been submitted, completenessScore should be 0 and gaps should cover all major expected areas for the role
- Maximum 8 gaps
- strengths can be empty array if nothing is documented yet
- Be realistic — not every role needs 20 documents. A junior role might be complete with 3-4 items`;

  try {
    const result = await generateJSON<KnowledgeGapResult>(prompt);

    const completenessScore = Math.max(0, Math.min(100, Math.round(Number(result.completenessScore) || 0)));
    const gaps = Array.isArray(result.gaps)
      ? result.gaps.slice(0, 8).map((g) => ({
          area: String(g.area || ""),
          severity: (["critical", "high", "medium", "low"].includes(g.severity) ? g.severity : "medium") as "critical" | "high" | "medium" | "low",
          description: String(g.description || ""),
          suggestedPrompt: String(g.suggestedPrompt || ""),
        }))
      : [];

    await db.collection("offboardFlows").doc(flowId).update({
      knowledgeGapAnalysis: {
        completenessScore,
        gaps,
        strengths: Array.isArray(result.strengths) ? result.strengths.slice(0, 3) : [],
        overallAssessment: typeof result.overallAssessment === "string" ? result.overallAssessment : "",
        analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    });

    await db.collection("offboardFlows").doc(flowId).update({
      "completionScores.knowledge": completenessScore,
    });

    console.log(`Knowledge gap analysis completed for flow ${flowId}: ${completenessScore}% complete, ${gaps.length} gaps found`);

    return {
      completenessScore,
      gaps,
      strengths: Array.isArray(result.strengths) ? result.strengths.slice(0, 3) : [],
      overallAssessment: typeof result.overallAssessment === "string" ? result.overallAssessment : "",
    };
  } catch (error) {
    console.error(`Knowledge gap detection failed for flow ${flowId}:`, error);
    throw new functions.https.HttpsError("internal", "AI analysis failed. Please try again.");
  }
});
