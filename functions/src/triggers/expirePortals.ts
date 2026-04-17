import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Runs daily at midnight UTC.
 * Finds offboarding flows where:
 *   - status is "not_started" or "in_progress"
 *   - lastWorkingDay + 7 days < now
 * Marks them as "portal_expired" by setting portalExpired: true on the flow.
 * Does NOT change flow status — HR still needs to manually close it.
 * Also sends a Firestore notification to HR admins of the company.
 */
export const expirePortals = functions.pubsub
  .schedule("every 24 hours")
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    // Calculate cutoff: flows where lastWorkingDay was more than 7 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

    try {
      // Find active flows with lastWorkingDay older than 7 days ago
      const expiredSnap = await db
        .collection("offboardFlows")
        .where("status", "in", ["not_started", "in_progress"])
        .where("lastWorkingDay", "<=", cutoffTimestamp)
        .where("portalExpired", "!=", true)  // skip already marked
        .get();

      if (expiredSnap.empty) {
        console.log("No newly expired portals found.");
        return;
      }

      console.log(`Found ${expiredSnap.size} newly expired portals.`);

      const batch = db.batch();

      for (const doc of expiredSnap.docs) {
        const flow = doc.data();

        // Mark portal as expired on the flow
        batch.update(doc.ref, {
          portalExpired: true,
          portalExpiredAt: now,
          updatedAt: now,
        });

        // Create a notification for HR admins of this company
        // Query HR admins for this company and notify them
        const hrUsersSnap = await db
          .collection("users")
          .where("companyId", "==", flow.companyId)
          .where("role", "in", ["hr_admin", "super_admin"])
          .get();

        for (const hrUser of hrUsersSnap.docs) {
          const notifRef = db.collection("notifications").doc();
          batch.set(notifRef, {
            id: notifRef.id,
            companyId: flow.companyId,
            userId: hrUser.id,
            type: "portal_expired",
            title: `Portal expired: ${flow.employeeName}`,
            message: `${flow.employeeName}'s exit portal expired 7 days after their last working day. Please close this offboarding.`,
            link: `/offboardings/${doc.id}`,
            isRead: false,
            createdAt: now,
          });
        }
      }

      await batch.commit();
      console.log(`Marked ${expiredSnap.size} portals as expired.`);
    } catch (error) {
      console.error("expirePortals error:", error);
    }
  });
