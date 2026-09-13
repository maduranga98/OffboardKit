import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendSmtpEmail } from "../email/smtpClient";
import { assertCompanyActive } from "../billing/access";
import { buildAlumniSetupUrl, normalizeEmail } from "../alumni/inviteLink";
import { alumniInviteHtml } from "../alumni/inviteEmail";

export const sendAlumniInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }

  const { profileId } = data as { profileId?: string };
  if (!profileId || typeof profileId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "profileId required");
  }

  const db = admin.firestore();

  const profileDoc = await db.collection("alumniProfiles").doc(profileId).get();
  if (!profileDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Alumni profile not found");
  }

  const profile = profileDoc.data()!;

  // Verify caller belongs to the same company
  const callerDoc = await db.collection("users").doc(context.auth.uid).get();
  const caller = callerDoc.data();
  if (!caller || caller.companyId !== profile.companyId) {
    throw new functions.https.HttpsError("permission-denied", "Not authorized");
  }

  // The subscription lock is enforced here too: callables use the admin
  // SDK, so firestore.rules never sees their writes.
  await assertCompanyActive(profile.companyId as string);

  const storedEmail = (profile.email as string | undefined)?.trim();
  if (!storedEmail) {
    throw new functions.https.HttpsError("invalid-argument", "Alumni has no email address");
  }
  // Firebase Auth lower-cases every address it stores, so `firebaseUser.email`
  // in the portal is always lower case. A profile saved as "Jane.Doe@corp.com"
  // therefore never matched the portal's `where("email", "==", ...)` lookup and
  // the alumni was bounced with "No alumni account found with this email".
  // Normalising here heals those rows the first time an invite goes out.
  const email = normalizeEmail(storedEmail);

  // Look up company name
  let companyName = "your company";
  try {
    const companyDoc = await db.collection("companies").doc(profile.companyId as string).get();
    companyName = (companyDoc.data()?.name as string) || "your company";
  } catch {
    // Use fallback
  }

  const { url: setupPasswordUrl, authUid } = await buildAlumniSetupUrl({
    email,
    companyId: profile.companyId as string | undefined,
    displayName: profile.name as string | undefined,
  });

  await sendSmtpEmail({
    to: [{ email, name: (profile.name as string) || undefined }],
    subject: `You've been invited to the ${companyName} alumni network`,
    htmlContent: alumniInviteHtml({
      name: (profile.name as string) || "there",
      email,
      companyName,
      setupPasswordUrl,
    }),
  });

  // Sending an invite is an explicit opt-in by HR. Persisting it (plus the
  // auth UID) means the alumni is not bounced with "account not activated"
  // the moment they finish setting their password.
  const update: Record<string, unknown> = {
    invitationSentAt: admin.firestore.FieldValue.serverTimestamp(),
    optedIn: true,
  };
  if (email !== storedEmail) update.email = email;
  if (authUid && !profile.authUid) update.authUid = authUid;
  await profileDoc.ref.update(update);

  console.log(`Alumni invite sent to ${email}`);
  return { success: true };
});
