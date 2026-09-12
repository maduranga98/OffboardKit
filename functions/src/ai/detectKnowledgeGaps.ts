import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { ANTHROPIC_SECRETS, generateJSON, type JSONSchema } from "./claudeClient";
import { assertCompanyActive } from "../billing/access";

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

// Structured-output schemas accept only a subset of JSON Schema: no numeric
// constraints (minimum/maximum), no string length, no array length. Bounds are
// stated in the prompt and enforced on the parsed result below.
const KNOWLEDGE_GAP_SCHEMA: JSONSchema = {
  type: "object",
  properties: {
    completenessScore: { type: "integer" },
    gaps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          area: { type: "string" },
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          description: { type: "string" },
          suggestedPrompt: { type: "string" },
        },
        required: ["area", "severity", "description", "suggestedPrompt"],
        additionalProperties: false,
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    overallAssessment: { type: "string" },
  },
  required: ["completenessScore", "gaps", "strengths", "overallAssessment"],
  additionalProperties: false,
};

export const detectKnowledgeGaps = functions
  .runWith({ secrets: [...ANTHROPIC_SECRETS], timeoutSeconds: 120 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }

    const { flowId } = data;
    if (!flowId || typeof flowId !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "flowId required");
    }

    const db = admin.firestore();

    // Verify the Claude API key is available before doing any work
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new functions.https.HttpsError("failed-precondition", "ANTHROPIC_API_KEY is not configured");
    }

    const flowDoc = await db.collection("offboardFlows").doc(flowId).get();
    if (!flowDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Offboarding flow not found");
    }
    const flow = flowDoc.data()!;

    // Sanitize fields embedded in the Claude prompt: strip control chars,
    // collapse whitespace, cap length. Defends against prompt-injection via
    // malicious employee metadata written elsewhere in the system.
    const sanitize = (v: unknown, max = 200): string =>
      String(v ?? "")
        .replace(/[\x00-\x1F\x7F]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);
    const employeeName = sanitize(flow.employeeName);
    const employeeRole = sanitize(flow.employeeRole);
    const employeeDepartment = sanitize(flow.employeeDepartment);

    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    const caller = callerDoc.data();
    if (!caller || caller.companyId !== flow.companyId) {
      throw new functions.https.HttpsError("permission-denied", "Not authorized");
    }

    // The subscription lock is enforced here too: callables use the admin
    // SDK, so firestore.rules never sees their writes.
    await assertCompanyActive(flow.companyId as string);

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

Employee: ${employeeName}
Role: ${employeeRole}
Department: ${employeeDepartment}

Knowledge Items Submitted (${itemsList.length} items):
${itemsList.length === 0
    ? "(No knowledge items have been submitted yet)"
    : itemsList.map((item, i) =>
        `${i + 1}. [${item.type}] "${item.title}" — ${item.description || "(no description)"} ${item.successor ? `(for: ${item.successor})` : ""}`
      ).join("\n")
}

Offboarding Tasks (${tasksList.length} tasks):
${tasksList.map((t) => `- ${t.title} (${t.assigneeRole}) — ${t.status}`).join("\n")}

Based on the employee's role (${employeeRole}) and department (${employeeDepartment}), analyze what knowledge transfer items would typically be expected and identify gaps.

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
      const result = await generateJSON<KnowledgeGapResult>(prompt, KNOWLEDGE_GAP_SCHEMA);

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
        "completionScores.knowledge": completenessScore,
      });

      console.log(`Knowledge gap analysis completed for flow ${flowId}: ${completenessScore}% complete, ${gaps.length} gaps found`);

      return {
        completenessScore,
        gaps,
        strengths: Array.isArray(result.strengths) ? result.strengths.slice(0, 3) : [],
        overallAssessment: typeof result.overallAssessment === "string" ? result.overallAssessment : "",
      };
    } catch (error: any) {
      console.error(`Knowledge gap detection failed for flow ${flowId}:`, error);
      const message = error?.message || "Unknown error";
      throw new functions.https.HttpsError("internal", `AI analysis failed: ${message}`);
    }
  });
