import { functions } from "./firebase";
import { httpsCallable } from "firebase/functions";

interface AnalyticsPdfParams {
  companyId: string;
  dateRange: string;
  customStartDate?: string;
  customEndDate?: string;
}

export async function generateAnalyticsPdf(
  params: AnalyticsPdfParams
): Promise<void> {
  try {
    const generatePdf = httpsCallable(
      functions,
      "generateAnalyticsPdf"
    );

    const result = await generatePdf(params);
    const data = result.data as { pdf: string };

    // Convert base64 to blob
    const binaryString = atob(data.pdf);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/pdf" });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analytics-report-${new Date().toISOString().split("T")[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
}
