import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import * as puppeteer from "puppeteer";

interface KnowledgePdfRequest {
  companyId: string;
  typeFilter?: string;
  statusFilter?: string;
  departmentFilter?: string;
  gapFilter?: string;
}

const BRAND = {
  teal: "#0D9E8A",
  navy: "#0F1C2E",
  muted: "#6B7280",
  warmBg: "#F5F0E8",
  white: "#FFFFFF",
  red: "#DC2626",
  amber: "#D97706",
};

const TYPE_LABELS: Record<string, string> = {
  process: "Process",
  contact: "Contact",
  document: "Document",
  credential_handover: "Credential Handover",
  video_link: "Video Link",
  note: "Note",
};

const TYPE_COLORS: Record<string, string> = {
  process: "#0D9E8A",
  contact: "#2563EB",
  document: "#0F1C2E",
  credential_handover: "#DC4A18",
  video_link: "#7C3AED",
  note: "#D97706",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#DC4A18",
  high: "#EA580C",
  medium: "#D97706",
  low: "#2563EB",
};

export const generateKnowledgePdf = functions
  .runWith({ memory: "2GB", timeoutSeconds: 300 })
  .https.onCall(
  async (data: KnowledgePdfRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "User is not authenticated");
    }

    const { companyId } = data;

    const db = getFirestore();
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    const caller = callerDoc.data();
    if (!caller || caller.companyId !== companyId) {
      throw new functions.https.HttpsError("permission-denied", "Not authorized");
    }

    try {
      const html = await buildKnowledgeHtml({ db, ...data });

      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        margin: { top: 24, right: 24, bottom: 24, left: 24 },
        printBackground: true,
      });

      await browser.close();

      return { success: true, pdf: Buffer.from(pdfBuffer).toString("base64") };
    } catch (error) {
      console.error("Knowledge PDF error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to generate PDF";
      throw new functions.https.HttpsError("internal", message);
    }
  }
);

async function buildKnowledgeHtml(
  params: KnowledgePdfRequest & { db: FirebaseFirestore.Firestore }
): Promise<string> {
  const { companyId, typeFilter, statusFilter, departmentFilter, gapFilter, db } = params;

  let query = db.collection("knowledgeItems").where("companyId", "==", companyId) as FirebaseFirestore.Query;
  if (typeFilter && typeFilter !== "all") query = query.where("type", "==", typeFilter);
  if (statusFilter && statusFilter !== "all") query = query.where("status", "==", statusFilter);
  if (departmentFilter && departmentFilter !== "all")
    query = query.where("employeeDepartment", "==", departmentFilter);

  const snap = await query.orderBy("createdAt", "desc").get();
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];

  if (gapFilter === "true") items = items.filter((i) => i.hasGap);
  else if (gapFilter === "false") items = items.filter((i) => !i.hasGap);

  const total = items.length;
  const reviewed = items.filter((i) => i.status === "reviewed").length;
  const withGaps = items.filter((i) => i.hasGap).length;
  const verificationPending = items.filter(
    (i) => i.managerVerificationStatus === "pending" || (!i.managerVerified && i.status === "reviewed")
  ).length;

  const now = new Date();

  function statusBadge(status: unknown): string {
    if (status === "reviewed") return `<span style="background:#D1FAE5;color:#065F46;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">Reviewed</span>`;
    if (status === "submitted") return `<span style="background:#FEF3C7;color:#92400E;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">Submitted</span>`;
    return `<span style="background:#F3F4F6;color:#6B7280;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">Draft</span>`;
  }

  function typeBadge(type: unknown): string {
    const label = TYPE_LABELS[type as string] || String(type);
    const color = TYPE_COLORS[type as string] || BRAND.muted;
    return `<span style="color:${color};font-size:11px;font-weight:600;">${label}</span>`;
  }

  function severityBadge(sev: unknown): string {
    if (!sev) return "";
    const color = SEVERITY_COLORS[sev as string] || BRAND.muted;
    return `<span style="color:${color};font-size:11px;font-weight:600;text-transform:uppercase;">${sev}</span>`;
  }

  const rows = items
    .map(
      (item) => `
    <tr style="border-bottom:1px solid #F3F4F6;">
      <td style="padding:10px 8px;font-size:12px;color:${BRAND.navy};font-weight:500;max-width:200px;">${String(item.title || "").replace(/</g, "&lt;")}</td>
      <td style="padding:10px 8px;">${typeBadge(item.type)}</td>
      <td style="padding:10px 8px;font-size:12px;color:${BRAND.muted};">${String(item.employeeName || "")}</td>
      <td style="padding:10px 8px;font-size:12px;color:${BRAND.muted};">${String(item.employeeDepartment || "")}</td>
      <td style="padding:10px 8px;">${statusBadge(item.status)}</td>
      <td style="padding:10px 8px;">${item.hasGap ? severityBadge(item.gapSeverity) || `<span style="color:${BRAND.red};font-size:11px;font-weight:600;">GAP</span>` : `<span style="color:${BRAND.teal};font-size:11px;">—</span>`}</td>
      <td style="padding:10px 8px;font-size:12px;color:${BRAND.muted};">${item.successor ? String(item.successor) : "—"}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: ${BRAND.warmBg}; color: ${BRAND.navy}; padding: 32px; }
    table { border-collapse: collapse; width: 100%; }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="background:${BRAND.navy};border-radius:8px;padding:24px 28px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.3px;">HR<span style="color:${BRAND.teal};">ExitFlow</span></div>
      <div style="font-size:14px;color:rgba(255,255,255,0.6);margin-top:4px;">Knowledge Base Export</div>
    </div>
    <div style="text-align:right;color:rgba(255,255,255,0.5);font-size:12px;">
      Generated ${now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
    </div>
  </div>

  <!-- KPI Row -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
    ${[
      { label: "Total Items", value: total, color: BRAND.navy },
      { label: "Reviewed", value: `${total > 0 ? Math.round((reviewed / total) * 100) : 0}%`, color: BRAND.teal },
      { label: "With Gaps", value: withGaps, color: withGaps > 0 ? BRAND.red : BRAND.navy },
      { label: "Needs Verification", value: verificationPending, color: verificationPending > 0 ? BRAND.amber : BRAND.navy },
    ]
      .map(
        (k) =>
          `<div style="background:#fff;border-radius:8px;padding:16px 20px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${BRAND.muted};margin-bottom:6px;">${k.label}</div>
        <div style="font-size:26px;font-weight:700;color:${k.color};">${k.value}</div>
      </div>`
      )
      .join("")}
  </div>

  <!-- Table -->
  <div style="background:#fff;border-radius:8px;padding:20px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <h2 style="font-size:15px;font-weight:600;color:${BRAND.navy};margin-bottom:16px;">Knowledge Items (${total})</h2>
    ${total === 0 ? `<p style="color:${BRAND.muted};text-align:center;padding:32px 0;">No items match the selected filters.</p>` : `
    <table>
      <thead>
        <tr style="background:#F9FAFB;border-bottom:2px solid #E5E7EB;">
          <th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${BRAND.muted};">Title</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${BRAND.muted};">Type</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${BRAND.muted};">Employee</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${BRAND.muted};">Dept</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${BRAND.muted};">Status</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${BRAND.muted};">Gap</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${BRAND.muted};">Successor</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`}
  </div>

  <!-- Footer -->
  <div style="text-align:center;margin-top:20px;font-size:11px;color:${BRAND.muted};">
    Exported from HRExitFlow · hrexitflow.com
  </div>
</body>
</html>`;
}
