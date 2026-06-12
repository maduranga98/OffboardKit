import * as functions from "firebase-functions";

export const testSlackWebhook = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }

  const { webhookUrl } = data as { webhookUrl?: string };
  if (!webhookUrl || typeof webhookUrl !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "webhookUrl required");
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "✅ OffboardSet connected successfully!" }),
    });

    if (!response.ok) {
      throw new functions.https.HttpsError("unavailable", "Webhook returned an error response");
    }

    return { success: true };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError("unavailable", "Could not reach webhook URL");
  }
});
