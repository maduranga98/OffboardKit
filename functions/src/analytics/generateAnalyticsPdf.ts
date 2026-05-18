import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import * as puppeteer from "puppeteer";

interface AnalyticsPdfRequest {
  companyId: string;
  dateRange: string;
  customStartDate?: string;
  customEndDate?: string;
}

export const generateAnalyticsPdf = functions
  .runWith({ memory: "2GB", timeoutSeconds: 300 })
  .https.onCall(
  async (data: AnalyticsPdfRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User is not authenticated"
      );
    }

    const { companyId, dateRange, customStartDate, customEndDate } = data;

    // Verify caller belongs to the requested company
    const db = getFirestore();
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    const caller = callerDoc.data();
    if (!caller || caller.companyId !== companyId) {
      throw new functions.https.HttpsError("permission-denied", "Not authorized");
    }

    try {
      const html = await generateAnalyticsHtml({
        companyId,
        dateRange,
        customStartDate,
        customEndDate,
      });

      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
      const page = await browser.newPage();

      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
        printBackground: true,
      });

      await browser.close();

      return {
        success: true,
        pdf: Buffer.from(pdfBuffer).toString("base64"),
      };
    } catch (error) {
      console.error("PDF generation error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to generate PDF";
      throw new functions.https.HttpsError("internal", message);
    }
  }
);

function getDateBounds(
  dateRange: string,
  customStartDate?: string,
  customEndDate?: string
): { start: Date | null; end: Date | null } {
  const now = new Date();
  if (dateRange === "all") return { start: null, end: null };
  if (dateRange === "custom") {
    return {
      start: customStartDate ? new Date(customStartDate) : null,
      end: customEndDate ? new Date(customEndDate + "T23:59:59") : null,
    };
  }
  const msMap: Record<string, number> = {
    "30d": 30,
    "90d": 90,
    "6m": 183,
    "1y": 365,
  };
  const days = msMap[dateRange];
  if (!days) return { start: null, end: null };
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return { start, end: now };
}

async function generateAnalyticsHtml(params: {
  companyId: string;
  dateRange: string;
  customStartDate?: string;
  customEndDate?: string;
}): Promise<string> {
  const { companyId, dateRange, customStartDate, customEndDate } = params;
  const db = getFirestore();

  const flowsSnapshot = await db
    .collection("offboardFlows")
    .where("companyId", "==", companyId)
    .get();
  const allFlows = flowsSnapshot.docs.map((doc) => doc.data());

  // Apply date range filter
  const { start, end } = getDateBounds(dateRange, customStartDate, customEndDate);
  const flows = allFlows.filter((f) => {
    if (!start && !end) return true;
    const createdAt = f.createdAt?.toDate ? f.createdAt.toDate() : null;
    if (!createdAt) return false;
    if (start && createdAt < start) return false;
    if (end && createdAt > end) return false;
    return true;
  });

  const completedFlows = flows.filter((f) => f.status === "completed");

  const dateRangeLabel =
    dateRange === "custom"
      ? `${customStartDate || "—"} to ${customEndDate || "—"}`
      : dateRange === "all"
        ? "All time"
        : dateRange === "30d" ? "Last 30 days"
        : dateRange === "90d" ? "Last 90 days"
        : dateRange === "6m" ? "Last 6 months"
        : dateRange === "1y" ? "Last 1 year"
        : dateRange;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>OffboardSet Analytics Report</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; color: #0F1C2E; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0D9E8A; padding-bottom: 20px; }
        .header h1 { margin: 0; color: #0F1C2E; }
        .header p { margin: 5px 0 0 0; color: #6B7280; font-size: 14px; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
        .stat-card { padding: 15px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; }
        .stat-card h3 { margin: 0; font-size: 12px; color: #6B7280; text-transform: uppercase; }
        .stat-card .value { font-size: 24px; font-weight: bold; color: #0F1C2E; margin: 10px 0 0 0; }
        .section { margin-bottom: 30px; }
        .section h2 { margin: 0 0 15px 0; font-size: 18px; color: #0F1C2E; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f4f6; padding: 10px; text-align: left; font-weight: 600; font-size: 12px; color: #6B7280; border-bottom: 2px solid #d1d5db; }
        td { padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6B7280; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>OffboardSet Analytics Report</h1>
        <p>Generated on ${new Date().toLocaleDateString()} · Period: ${dateRangeLabel}</p>
      </div>

      <div class="stats">
        <div class="stat-card">
          <h3>Total Exits</h3>
          <div class="value">${flows.length}</div>
        </div>
        <div class="stat-card">
          <h3>Completed</h3>
          <div class="value">${completedFlows.length}</div>
        </div>
        <div class="stat-card">
          <h3>Completion Rate</h3>
          <div class="value">${flows.length > 0 ? Math.round((completedFlows.length / flows.length) * 100) : 0}%</div>
        </div>
        <div class="stat-card">
          <h3>Period</h3>
          <div class="value" style="font-size:14px">${dateRangeLabel}</div>
        </div>
      </div>

      <div class="section">
        <h2>Recently Completed Offboardings</h2>
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>Department</th>
              <th>Completed Date</th>
            </tr>
          </thead>
          <tbody>
            ${completedFlows
              .slice(0, 10)
              .map(
                (f) => `
              <tr>
                <td>${f.employeeName || "—"}</td>
                <td>${f.employeeRole || "—"}</td>
                <td>${f.employeeDepartment || "—"}</td>
                <td>${
                  f.completedAt
                    ? new Date(f.completedAt.toDate()).toLocaleDateString()
                    : "—"
                }</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>This report was generated by OffboardSet</p>
      </div>
    </body>
    </html>
  `;

  return html;
}
