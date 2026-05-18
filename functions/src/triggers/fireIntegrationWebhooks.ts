import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

// Outbound webhooks deliver offboarding state-changes to whichever HRIS
// or identity provider the company has registered. Each delivery is a
// POST with a JSON envelope { event, occurredAt, data }; if the
// integration has a configured secret, an X-OffboardSet-Signature
// header carries an HMAC-SHA256 of the raw body.
//
// Failures don't block the Firestore write — they're stamped onto the
// integration doc (lastError / lastStatus) so the operator can see
// what's wrong in the UI.

type EventKey =
  | "flow_completed"
  | "flow_cancelled"
  | "approval_completed"
  | "asset_wiped";

interface IntegrationDoc {
  id: string;
  companyId: string;
  webhookUrl: string;
  secret?: string;
  events: EventKey[];
  isActive: boolean;
}

async function deliver(
  integration: IntegrationDoc,
  event: EventKey,
  data: Record<string, unknown>
) {
  const body = JSON.stringify({
    event,
    occurredAt: new Date().toISOString(),
    data,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "OffboardSet-Webhook/1.0",
  };
  if (integration.secret) {
    headers["X-OffboardSet-Signature"] = crypto
      .createHmac("sha256", integration.secret)
      .update(body)
      .digest("hex");
  }
  const db = admin.firestore();
  try {
    const res = await fetch(integration.webhookUrl, {
      method: "POST",
      headers,
      body,
    });
    const ok = res.status >= 200 && res.status < 300;
    await db.collection("integrations").doc(integration.id).update({
      lastTriggeredAt: admin.firestore.FieldValue.serverTimestamp(),
      lastStatus: ok ? "success" : "error",
      lastError: ok ? "" : `HTTP ${res.status}`,
    });
    if (!ok) {
      console.warn(
        `Webhook ${integration.id} responded ${res.status} for event ${event}`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook ${integration.id} delivery failed:`, message);
    await db.collection("integrations").doc(integration.id).update({
      lastTriggeredAt: admin.firestore.FieldValue.serverTimestamp(),
      lastStatus: "error",
      lastError: message.slice(0, 200),
    });
  }
}

async function fanOut(
  companyId: string,
  event: EventKey,
  data: Record<string, unknown>
) {
  const db = admin.firestore();
  const snap = await db
    .collection("integrations")
    .where("companyId", "==", companyId)
    .where("isActive", "==", true)
    .get();
  for (const docSnap of snap.docs) {
    const i = docSnap.data() as IntegrationDoc;
    if (!Array.isArray(i.events) || !i.events.includes(event)) continue;
    await deliver({ ...i, id: docSnap.id }, event, data);
  }
}

export const fireFlowWebhooks = functions.firestore
  .document("offboardFlows/{flowId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const flowId = context.params.flowId;

    const flowPayload = {
      flowId,
      employeeName: after.employeeName,
      employeeEmail: after.employeeEmail,
      employeeRole: after.employeeRole,
      employeeDepartment: after.employeeDepartment,
      lastWorkingDay: after.lastWorkingDay?.toDate?.()?.toISOString() ?? null,
    };

    if (before.status !== "completed" && after.status === "completed") {
      await fanOut(after.companyId, "flow_completed", {
        ...flowPayload,
        completedAt: after.completedAt?.toDate?.()?.toISOString() ?? null,
      });
    }
    if (before.status !== "cancelled" && after.status === "cancelled") {
      await fanOut(after.companyId, "flow_cancelled", flowPayload);
    }
    if (
      before.approvalStatus !== "approved" &&
      after.approvalStatus === "approved"
    ) {
      await fanOut(after.companyId, "approval_completed", flowPayload);
    }
  });

export const fireAssetWebhooks = functions.firestore
  .document("assets/{assetId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status === after.status) return;
    if (after.status !== "wiped") return;
    if (!after.companyId) return;
    await fanOut(after.companyId, "asset_wiped", {
      assetId: context.params.assetId,
      flowId: after.flowId,
      name: after.name,
      type: after.type,
      serialNumber: after.serialNumber,
      wipeCompletedAt:
        after.wipeCompletedAt?.toDate?.()?.toISOString() ?? null,
    });
  });
