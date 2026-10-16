import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/** How recently the caller must have typed their password. */
const MAX_AUTH_AGE_SECONDS = 5 * 60;

/**
 * Ends every other session of the caller after a password change.
 *
 * Firebase already kills a user's refresh tokens when the password changes,
 * but an ID token that was minted before the change keeps working for up to an
 * hour — and security rules cannot see revocation. A hijacked session would
 * therefore outlive the very password change meant to evict it.
 *
 * This closes that window in two steps:
 *   1. revokeRefreshTokens, so no session can mint a new ID token.
 *   2. Stamp sessionRevocations/{uid}.validAfter. firestore.rules reject any
 *      token whose auth_time (when that sign-in happened) is older than it, so
 *      tokens issued before the change are refused immediately, not in an hour.
 *
 * The caller must have signed in within the last few minutes, so a stolen
 * session cannot call this to lock the real owner out. The caller's own client
 * signs in again with the new password straight afterwards, which yields a
 * token newer than validAfter.
 */
export const revokeOtherSessions = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }

  const uid = context.auth.uid;
  const authTime = Number(context.auth.token.auth_time ?? 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!authTime || nowSeconds - authTime > MAX_AUTH_AGE_SECONDS) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Please confirm your password again before ending other sessions."
    );
  }

  await admin.auth().revokeRefreshTokens(uid);
  await admin.firestore().doc(`sessionRevocations/${uid}`).set({
    validAfter: nowSeconds,
    revokedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { validAfter: nowSeconds };
});
