import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Writes immutable audit entries to offboardFlows/{flowId}/auditLog so HR
// has a tamper-evident record of every state change for compliance
// (GDPR, SOX). All writes happen through admin triggers — client-side
// writes to the subcollection are denied by firestore.rules.

type ActorType = "user" | "portal" | "system";

interface AuditWrite {
  flowId: string;
  companyId: string;
  action: string;
  actorType: ActorType;
  actorId?: string | null;
  actorName?: string | null;
  summary: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  metadata?: Record<string, unknown>;
}

async function writeAudit(entry: AuditWrite): Promise<void> {
  const db = admin.firestore();
  const ref = db
    .collection("offboardFlows")
    .doc(entry.flowId)
    .collection("auditLog")
    .doc();
  await ref.set({
    id: ref.id,
    flowId: entry.flowId,
    companyId: entry.companyId,
    action: entry.action,
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    actorName: entry.actorName ?? null,
    summary: entry.summary,
    changes: entry.changes ?? null,
    metadata: entry.metadata ?? null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function resolveActor(
  companyId: string,
  actorId: string | null | undefined
): Promise<{ actorType: ActorType; actorId: string | null; actorName: string | null }> {
  if (!actorId) {
    return { actorType: "system", actorId: null, actorName: null };
  }
  try {
    const userDoc = await admin.firestore().collection("users").doc(actorId).get();
    const u = userDoc.data();
    if (u && u.companyId === companyId) {
      return {
        actorType: "user",
        actorId,
        actorName: (u.displayName as string) || (u.email as string) || actorId,
      };
    }
  } catch {
    // fall through
  }
  return { actorType: "user", actorId, actorName: null };
}

export const auditFlowCreated = functions.firestore
  .document("offboardFlows/{flowId}")
  .onCreate(async (snap, context) => {
    const flow = snap.data();
    const flowId = context.params.flowId;
    const actor = await resolveActor(flow.companyId, flow.managerId);
    await writeAudit({
      flowId,
      companyId: flow.companyId,
      action: "flow_created",
      actorType: actor.actorType,
      actorId: actor.actorId,
      actorName: actor.actorName,
      summary: `Offboarding started for ${flow.employeeName} (${flow.employeeRole})`,
      metadata: {
        employeeEmail: flow.employeeEmail,
        templateId: flow.templateId,
      },
    });

    if (
      flow.approvalStatus === "pending" &&
      Array.isArray(flow.approvalSteps) &&
      flow.approvalSteps.length > 0
    ) {
      await writeAudit({
        flowId,
        companyId: flow.companyId,
        action: "approval_requested",
        actorType: "system",
        summary: `Approval requested (${flow.approvalSteps.length} approver${
          flow.approvalSteps.length === 1 ? "" : "s"
        })`,
      });
    }
  });

interface ApprovalStepShape {
  approverId: string;
  approverName: string;
  status: "waiting" | "pending" | "approved" | "rejected";
  note?: string;
}

export const auditFlowUpdated = functions.firestore
  .document("offboardFlows/{flowId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const flowId = context.params.flowId;

    // ---- Approval step transitions ---------------------------------------
    const beforeSteps = (before.approvalSteps as ApprovalStepShape[]) || [];
    const afterSteps = (after.approvalSteps as ApprovalStepShape[]) || [];
    if (afterSteps.length > 0 && beforeSteps.length === afterSteps.length) {
      for (let i = 0; i < afterSteps.length; i++) {
        const b = beforeSteps[i];
        const a = afterSteps[i];
        if (!b || b.status === a.status) continue;
        if (a.status === "approved" || a.status === "rejected") {
          await writeAudit({
            flowId,
            companyId: after.companyId,
            action:
              a.status === "approved"
                ? "approval_approved"
                : "approval_rejected",
            actorType: "user",
            actorId: a.approverId,
            actorName: a.approverName,
            summary:
              a.status === "approved"
                ? `${a.approverName} approved step ${i + 1}`
                : `${a.approverName} rejected step ${i + 1}`,
            metadata: { stepIndex: i, note: a.note || "" },
          });
        }
      }
    }
    if (
      before.approvalStatus !== "approved" &&
      after.approvalStatus === "approved"
    ) {
      await writeAudit({
        flowId,
        companyId: after.companyId,
        action: "approval_completed",
        actorType: "system",
        summary: "Approval chain complete — portal email released",
      });
    }
    if (
      !before.approvalStatus &&
      after.approvalStatus === "pending"
    ) {
      await writeAudit({
        flowId,
        companyId: after.companyId,
        action: "approval_requested",
        actorType: "system",
        summary: `Approval requested (${afterSteps.length} approver${
          afterSteps.length === 1 ? "" : "s"
        })`,
      });
    }

    // Portal-only fields → log as portal access (rate-limited: only when
    // portalLastAccessed actually changes).
    if (
      before.portalLastAccessed?.toMillis?.() !==
      after.portalLastAccessed?.toMillis?.()
    ) {
      await writeAudit({
        flowId,
        companyId: after.companyId,
        action: "portal_accessed",
        actorType: "portal",
        summary: `${after.employeeName} accessed the offboarding portal`,
      });
    }

    if (before.status !== after.status) {
      const actor = await resolveActor(after.companyId, after.lastUpdatedBy);
      const action =
        after.status === "completed"
          ? "flow_completed"
          : after.status === "cancelled"
          ? "flow_cancelled"
          : "flow_status_changed";
      await writeAudit({
        flowId,
        companyId: after.companyId,
        action,
        actorType: actor.actorType,
        actorId: actor.actorId,
        actorName: actor.actorName,
        summary: `Flow status changed: ${before.status} → ${after.status}`,
        changes: { status: { from: before.status, to: after.status } },
      });
    }
  });

export const auditTaskUpdated = functions.firestore
  .document("flowTasks/{taskId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status === after.status) return;

    const db = admin.firestore();
    const flowDoc = await db.collection("offboardFlows").doc(after.flowId).get();
    if (!flowDoc.exists) return;
    const companyId = flowDoc.data()!.companyId as string;

    // completedBy on portal updates is "employee" (or empty); treat empty/
    // "employee" as a portal actor, otherwise resolve as user.
    const completedBy = (after.completedBy as string) || "";
    let actor;
    if (!completedBy || completedBy === "employee") {
      actor = {
        actorType: "portal" as ActorType,
        actorId: null,
        actorName: null,
      };
    } else {
      actor = await resolveActor(companyId, completedBy);
    }

    await writeAudit({
      flowId: after.flowId,
      companyId,
      action: "task_status_changed",
      actorType: actor.actorType,
      actorId: actor.actorId,
      actorName: actor.actorName,
      summary: `Task "${after.title}" → ${after.status}`,
      changes: { status: { from: before.status, to: after.status } },
      metadata: { taskId: after.id, assigneeRole: after.assigneeRole },
    });
  });

export const auditExitInterviewSubmitted = functions.firestore
  .document("exitInterviewResponses/{responseId}")
  .onCreate(async (snap) => {
    const r = snap.data();
    if (!r.flowId || !r.companyId) return;
    await writeAudit({
      flowId: r.flowId,
      companyId: r.companyId,
      action: "exit_interview_submitted",
      actorType: "portal",
      summary: "Exit interview submitted",
      metadata: { responseId: snap.id },
    });
  });

export const auditAssetCreated = functions.firestore
  .document("assets/{assetId}")
  .onCreate(async (snap) => {
    const a = snap.data();
    if (!a.flowId || !a.companyId) return;
    const actor = await resolveActor(a.companyId, null);
    await writeAudit({
      flowId: a.flowId,
      companyId: a.companyId,
      action: "asset_assigned",
      actorType: actor.actorType,
      actorId: actor.actorId,
      actorName: actor.actorName,
      summary: `Asset assigned: ${a.name} (${a.type})`,
      metadata: {
        assetId: snap.id,
        serialNumber: a.serialNumber || null,
        estimatedValue: a.estimatedValue ?? null,
      },
    });
  });

export const auditAssetUpdated = functions.firestore
  .document("assets/{assetId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!after.flowId || !after.companyId) return;
    if (before.status === after.status) return;

    const actorId =
      after.status === "wiped"
        ? after.wipeCompletedBy
        : after.status === "verified"
        ? after.verifiedBy
        : after.returnedBy;
    const actor = await resolveActor(after.companyId, actorId || null);

    const actionMap: Record<string, string> = {
      returned: "asset_returned",
      verified: "asset_verified",
      wiped: "asset_wiped",
    };
    const action = actionMap[after.status] || "asset_status_changed";
    const verbMap: Record<string, string> = {
      returned: "returned",
      verified: "verified",
      wiped: "wiped",
    };
    const verb = verbMap[after.status] || after.status;

    await writeAudit({
      flowId: after.flowId,
      companyId: after.companyId,
      action,
      actorType: actor.actorType,
      actorId: actor.actorId,
      actorName: actor.actorName,
      summary: `Asset ${verb}: ${after.name}`,
      changes: { status: { from: before.status, to: after.status } },
      metadata: { assetId: after.id, type: after.type },
    });
  });

export const auditKnowledgeItemAdded = functions.firestore
  .document("knowledgeItems/{itemId}")
  .onCreate(async (snap) => {
    const k = snap.data();
    if (!k.flowId || !k.companyId) return;
    await writeAudit({
      flowId: k.flowId,
      companyId: k.companyId,
      action: "knowledge_item_added",
      actorType: "portal",
      summary: `Knowledge item added: "${k.title || "(untitled)"}"`,
      metadata: { itemId: snap.id, type: k.type },
    });
  });
