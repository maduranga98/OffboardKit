import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const db = admin.firestore();

export const onEngagementEventLogged = onDocumentCreated(
  "alumniEngagementLog/{logId}",
  async (event) => {
    try {
      const data = event.data?.data();
      if (!data) return null;

      const { alumniId, companyId, eventType } = data as {
        alumniId: string;
        companyId: string;
        eventType: string;
      };

      if (!alumniId || !companyId) return null;

      const alumniSnap = await db.collection("alumniProfiles").doc(alumniId).get();
      const alumni = alumniSnap.data();
      if (!alumni) return null;

      const now = Date.now();
      const cutoff90 = new Date(now - 90 * 86400000);
      const cutoff30 = new Date(now - 30 * 86400000);

      const [
        loginSnap,
        pulseSnap,
        jobViewSnap,
        alumniAppSnap,
        referralSnap,
      ] = await Promise.all([
        db.collection("alumniEngagementLog")
          .where("alumniId", "==", alumniId)
          .where("eventType", "==", "login")
          .orderBy("createdAt", "desc")
          .limit(1)
          .get(),
        db.collection("pulseResponses")
          .where("alumniId", "==", alumniId)
          .where("status", "==", "completed")
          .where("completedAt", ">=", admin.firestore.Timestamp.fromDate(cutoff90))
          .limit(1)
          .get(),
        db.collection("alumniEngagementLog")
          .where("alumniId", "==", alumniId)
          .where("eventType", "==", "job_viewed")
          .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(cutoff30))
          .limit(1)
          .get(),
        db.collection("alumniApplications")
          .where("alumniId", "==", alumniId)
          .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(cutoff30))
          .limit(1)
          .get(),
        db.collection("alumniApplications")
          .where("alumniId", "==", alumniId)
          .where("type", "==", "referral")
          .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(cutoff90))
          .limit(1)
          .get(),
      ]);

      // SIGNAL 1 — Last login recency
      let signal1 = 0;
      if (!loginSnap.empty) {
        const loginTs = loginSnap.docs[0].data().createdAt as admin.firestore.Timestamp;
        const daysSinceLogin = (now - loginTs.toMillis()) / 86400000;
        if (daysSinceLogin <= 7) signal1 = 25;
        else if (daysSinceLogin <= 30) signal1 = 18;
        else if (daysSinceLogin <= 90) signal1 = 8;
      }

      // SIGNAL 2 — openToReturn
      let signal2 = 0;
      if (alumni.openToReturn === true) signal2 = 20;
      else if (alumni.openToReturn === false) signal2 = -10;

      // SIGNAL 3 — Pulse survey response within 90 days
      const signal3 = pulseSnap.empty ? 0 : 10;

      // SIGNAL 4 — Job viewed within 30 days (+8) or applied within 30 days (+5)
      let signal4 = 0;
      if (!jobViewSnap.empty) signal4 += 8;
      if (!alumniAppSnap.empty) signal4 += 5;

      // SIGNAL 5 — Referral submitted within 90 days
      const signal5 = referralSnap.empty ? 0 : 12;

      // SIGNAL 6 — Time since exit decay
      let signal6 = 0;
      if (alumni.exitDate) {
        const exitDate = (alumni.exitDate as admin.firestore.Timestamp).toDate();
        const monthsSinceExit = (now - exitDate.getTime()) / (30.44 * 86400000);
        if (monthsSinceExit < 6) signal6 = 0;
        else if (monthsSinceExit < 12) signal6 = -5;
        else if (monthsSinceExit < 24) signal6 = -15;
        else signal6 = -25;
      }

      const rawScore = signal1 + signal2 + signal3 + signal4 + signal5 + signal6;
      const score = Math.max(0, Math.min(100, rawScore));
      const level = score >= 70 ? "high" : score >= 40 ? "medium" : "low";

      const updates: Record<string, unknown> = {
        engagementScore: score,
        engagementLevel: level,
        lastEngagementEventType: eventType,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (eventType === "login") {
        updates.lastActiveAlumniDate = FieldValue.serverTimestamp();
      }

      await db.collection("alumniProfiles").doc(alumniId).update(updates);

      return null;
    } catch (err) {
      console.error("onEngagementEventLogged error:", err);
      return null;
    }
  }
);
