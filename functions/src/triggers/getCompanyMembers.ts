import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const getCompanyMembers = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }

  try {
    const db = admin.firestore();

    // Get the caller's user doc to verify their company
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    const caller = callerDoc.data();
    if (!caller || !caller.companyId) {
      throw new functions.https.HttpsError("not-found", "User or company not found");
    }

    const companyId = caller.companyId;

    // Query all users in the same company
    const snapshot = await db
      .collection("users")
      .where("companyId", "==", companyId)
      .get();

    const members = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { members };
  } catch (error) {
    console.error("getCompanyMembers failed:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Failed to load company members");
  }
});
