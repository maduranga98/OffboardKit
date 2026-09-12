import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendSmtpEmail } from "../email/smtpClient";
import { buildAlumniSetupUrl } from "../alumni/inviteLink";
import { alumniInviteHtml } from "../alumni/inviteEmail";

export const onAlumniOptedIn = functions.firestore
  .document("alumniProfiles/{profileId}")
  .onWrite(async (change) => {
    const after = change.after.exists ? change.after.data() : null;
    if (!after) return;

    const before = change.before.exists ? change.before.data() : null;
    const wasOptedIn = Boolean(before?.optedIn);
    const isOptedIn = Boolean(after.optedIn);
    if (!isOptedIn || wasOptedIn) return;
    if (after.invitationSentAt) return;

    const email = (after.email as string | undefined)?.trim();
    if (!email) return;

    let companyName = (after.companyName as string) || "";
    if (!companyName && after.companyId) {
      try {
        const companyDoc = await admin
          .firestore()
          .collection("companies")
          .doc(after.companyId as string)
          .get();
        companyName = (companyDoc.data()?.name as string) || "your company";
      } catch {
        companyName = "your company";
      }
    }
    if (!companyName) companyName = "your company";

    const { url: setupPasswordUrl, authUid } = await buildAlumniSetupUrl({
      email,
      companyId: after.companyId as string | undefined,
      displayName: after.name as string | undefined,
    });

    try {
      await sendSmtpEmail({
        to: [{ email, name: (after.name as string) || undefined }],
        subject: `You've been invited to the ${companyName} alumni network`,
        htmlContent: alumniInviteHtml({
          name: (after.name as string) || "there",
          email,
          companyName,
          setupPasswordUrl,
        }),
      });
      const update: Record<string, unknown> = {
        invitationSentAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (authUid && !after.authUid) update.authUid = authUid;
      await change.after.ref.update(update);
    } catch (err) {
      console.error("onAlumniOptedIn email failed", err);
    }
  });
