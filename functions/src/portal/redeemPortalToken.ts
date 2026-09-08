import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Exchanges an exit-portal link token for a short-lived Firebase custom token
 * scoped to exactly one offboarding flow.
 *
 * The portal is used by departing employees who have no account, so this is
 * intentionally callable without auth. It is the ONLY place the portalToken is
 * ever compared: security rules never see the raw token, they only trust the
 * `portal`/`flowId`/`companyId` claims minted here. That means a caller can
 * only ever reach the one flow whose token they actually hold.
 */
export const redeemPortalToken = onCall(async (request) => {
  const { token } = (request.data ?? {}) as { token?: unknown };

  // Tokens are crypto.randomUUID() values. Validate shape before querying so
  // malformed input can't be used to probe the collection.
  if (
    typeof token !== "string" ||
    !/^[0-9a-fA-F-]{36}$/.test(token)
  ) {
    throw new HttpsError("invalid-argument", "Invalid portal link.");
  }

  const db = admin.firestore();
  const snap = await db
    .collection("offboardFlows")
    .where("portalToken", "==", token)
    .limit(1)
    .get();

  // Deliberately identical error for "no such token" and "expired" so the
  // endpoint can't be used as a token oracle.
  const invalid = new HttpsError(
    "permission-denied",
    "This portal link is invalid or has expired."
  );

  if (snap.empty) {
    functions.logger.warn("Portal token redemption failed: no match");
    throw invalid;
  }

  const flowDoc = snap.docs[0];
  const flow = flowDoc.data();

  const expiresAt = flow.portalExpiresAt as admin.firestore.Timestamp | null | undefined;
  if (expiresAt && expiresAt.toMillis() < Date.now()) {
    functions.logger.warn("Portal token redemption failed: expired", {
      flowId: flowDoc.id,
    });
    throw invalid;
  }

  if (!flow.companyId || typeof flow.companyId !== "string") {
    throw invalid;
  }

  // uid is derived from the flow, so re-opening the link reuses the same
  // identity rather than creating an account per visit.
  // Named portalCompanyId, not companyId: a plain `companyId` claim means
  // "staff of that tenant" to the storage rules, and a portal visitor is not
  // staff. Keeping the namespaces separate stops one from being mistaken for
  // the other.
  const customToken = await admin.auth().createCustomToken(`portal_${flowDoc.id}`, {
    portal: true,
    flowId: flowDoc.id,
    portalCompanyId: flow.companyId,
  });

  await flowDoc.ref
    .update({ portalLastAccessed: admin.firestore.FieldValue.serverTimestamp() })
    .catch((err) => functions.logger.error("portalLastAccessed update failed", err));

  return { customToken, flowId: flowDoc.id, companyId: flow.companyId };
});

/**
 * Same exchange for the standalone pulse-survey links sent to alumni.
 * Scoped to a single pulseResponse document.
 */
export const redeemSurveyToken = onCall(async (request) => {
  const { token } = (request.data ?? {}) as { token?: unknown };

  if (typeof token !== "string" || token.length < 8 || token.length > 200) {
    throw new HttpsError("invalid-argument", "Invalid survey link.");
  }

  const db = admin.firestore();
  const snap = await db
    .collection("pulseResponses")
    .where("token", "==", token)
    .limit(1)
    .get();

  const invalid = new HttpsError(
    "permission-denied",
    "This survey link is invalid or has expired."
  );

  if (snap.empty) {
    throw invalid;
  }

  const responseDoc = snap.docs[0];
  const response = responseDoc.data();

  if (!response.surveyId || !response.companyId) {
    throw invalid;
  }

  const customToken = await admin.auth().createCustomToken(`survey_${responseDoc.id}`, {
    survey: true,
    responseId: responseDoc.id,
    surveyId: response.surveyId,
    surveyCompanyId: response.companyId,
  });

  return {
    customToken,
    responseId: responseDoc.id,
    surveyId: response.surveyId,
    companyId: response.companyId,
  };
});
