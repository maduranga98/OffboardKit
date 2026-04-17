import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import * as puppeteer from "puppeteer";

interface AnalyticsPdfRequest {
  companyId: string;
  dateRange: string;
  customStartDate?: string;
  customEndDate?: string;
}

export const generateAnalyticsPdf = functions.https.onCall(
  async (data: AnalyticsPdfRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User is not authenticated"
      );
    }

    const { companyId, dateRange, customStartDate, customEndDate } = data;

    try {
      const db = getFirestore();

      const html = await generateAnalyticsHtml({
        companyId,
        dateRange,
        customStartDate,
        customEndDate,
      });

      const browser = await puppeteer.launch({ headless: true });
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
      throw new functions.https.HttpsError(
        "internal",
        "Failed to generate PDF"
      );
    }
  }
);

async function generateAnalyticsHtml(params: {
  companyId: string;
  dateRange: string;
  customStartDate?: string;
  customEndDate?: string;
}): Promise<string> {
  const { companyId, dateRange } = params;
  const db = getFirestore();

  const flowsSnapshot = await db
    .collection("offboardFlows")
    .where("companyId", "==", companyId)
    .get();
  const flows = flowsSnapshot.docs.map((doc) => doc.data());

  const completedFlows = flows.filter((f) => f.status === "completed");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>OffboardKit Analytics Report</title>
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
        <h1>OffboardKit Analytics Report</h1>
        <p>Generated on ${new Date().toLocaleDateString()}</p>
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
          <h3>Date Range</h3>
          <div class="value">${dateRange}</div>
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
        <p>This report was generated by OffboardKit</p>
      </div>
    </body>
    </html>
  `;

  return html;
}
