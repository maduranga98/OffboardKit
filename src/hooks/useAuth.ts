import { useEffect, useRef } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import type { User } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, functions, googleProvider } from "../lib/firebase";
import {
  getDocument,
  setDocument,
  updateDocument,
  queryDocuments,
  where,
} from "../lib/firestore";
import { useAuthStore } from "../store/authStore";
import { useCompanyStore } from "../store/companyStore";
import type { AppUser } from "../types/user.types";
import type { Company } from "../types/company.types";

/**
 * Reads the `email` claim off the current ID token.
 *
 * firestore.rules compares the new user document's `email` against
 * `request.auth.token.email`, and the token — not `firebaseUser.email` — is
 * what the rule sees. They are normally identical, but an identity signed in
 * with a custom token carries no email claim at all, and writing "" there is
 * a guaranteed permission-denied. Taking the value from the token keeps the
 * document and the rule in exact agreement.
 */
async function tokenEmail(firebaseUser: User): Promise<string> {
  try {
    const { claims } = await firebaseUser.getIdTokenResult();
    return typeof claims.email === "string" ? claims.email : "";
  } catch {
    return firebaseUser.email || "";
  }
}

/**
 * Creates the tenantless staff document a brand new account starts with.
 *
 * Returns null when the identity cannot own one (no email claim), and falls
 * back to re-reading the document when the create is refused — a concurrent
 * sign-in callback may have won the race and already written it, which is a
 * success for this caller, not an error.
 */
async function createStaffUser(firebaseUser: User): Promise<AppUser | null> {
  const email = await tokenEmail(firebaseUser);
  if (!email) {
    console.warn(
      "Signed-in identity has no email claim; skipping staff profile creation."
    );
    return null;
  }

  // companyId and role are intentionally omitted from client control here —
  // security rules reject any client write to those fields. Membership is
  // granted server-side by claimCompany (setup wizard) or acceptInvite.
  const newUser: AppUser = {
    id: firebaseUser.uid,
    companyId: "",
    email,
    displayName: firebaseUser.displayName || "",
    photoURL: firebaseUser.photoURL || "",
    role: "super_admin",
    department: "",
    isActive: true,
    lastLoginAt: Timestamp.now(),
    createdAt: Timestamp.now(),
  };

  try {
    await setDocument("users", firebaseUser.uid, newUser);
    return newUser;
  } catch (err) {
    const existing = await getDocument<AppUser>("users", firebaseUser.uid).catch(
      () => null
    );
    if (existing) return existing;
    console.error("Could not create the staff profile for this account.", err);
    return null;
  }
}

export function useAuth() {
  const { user, appUser, companyId, loading, alumniLoginRequired, setUser, setAppUser, setCompanyId, setLoading, setAlumniLoginRequired, logout } =
    useAuthStore();
  const { setCompany } = useCompanyStore();
  const company = useCompanyStore((s) => s.company);
  // onAuthStateChanged fires again whenever the ID token is refreshed — and
  // this handler forces a refresh itself after re-syncing claims. Without a
  // guard the two runs overlap: both read a missing user document, both call
  // setDocument, and the second write lands on a document that now exists.
  // Security rules evaluate that as an *update* of every field, which only
  // ever allows displayName/photoURL/department/lastLoginAt/updatedAt — so
  // the second write failed with "Missing or insufficient permissions" and
  // took the whole profile load down with it.
  const inFlightUid = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        inFlightUid.current = null;
        logout();
        setCompany(null);
        return;
      }

      setUser(firebaseUser);

      if (inFlightUid.current === firebaseUser.uid) return;
      inFlightUid.current = firebaseUser.uid;

      try {
        let existingUser = await getDocument<AppUser>("users", firebaseUser.uid);

        if (!existingUser) {
          // Before creating a company user doc, verify this isn't an alumni
          // account. Alumni share the same Firebase Auth project but have
          // profiles in alumniProfiles, not users. If we find one, sign them
          // out and surface a redirect rather than creating a phantom company doc.
          if (firebaseUser.email) {
            try {
              const alumniMatches = await queryDocuments<{ id: string }>(
                "alumniProfiles",
                [where("email", "==", firebaseUser.email)]
              );
              if (alumniMatches.length > 0) {
                inFlightUid.current = null;
                await firebaseSignOut(auth);
                setAlumniLoginRequired(true);
                setLoading(false);
                return;
              }
            } catch {
              // Non-blocking: proceed with normal company user creation
            }
          }

          existingUser = await createStaffUser(firebaseUser);
          if (!existingUser) {
            // Nothing more to do: either the identity cannot own a staff
            // document, or the create was refused and no document appeared.
            setLoading(false);
            return;
          }
        } else {
          // The document is only ever *created* by the client. Re-writing it
          // wholesale on every sign-in is what security rules reject, so an
          // existing profile is only touched through the fields the rules
          // allow, and a failure here is never fatal to the session.
          void updateDocument<AppUser>("users", firebaseUser.uid, {
            lastLoginAt: Timestamp.now(),
          }).catch(() => undefined);
        }

        // If a pending invite is waiting for this email, the server validates
        // it and writes the membership, then we re-read the user document.
        if (!existingUser.companyId) {
          try {
            const acceptInvite = httpsCallable<
              Record<string, never>,
              { accepted: boolean; companyId?: string; role?: AppUser["role"] }
            >(functions, "acceptInvite");
            const { data } = await acceptInvite({});
            if (data.accepted && data.companyId) {
              existingUser = {
                ...existingUser,
                companyId: data.companyId,
                role: data.role ?? existingUser.role,
              };
            }
          } catch (inviteErr) {
            console.error("Invite acceptance failed", inviteErr);
          }
        }

        // Storage rules authorize from the companyId custom claim. Existing
        // accounts (and tokens issued mid-membership-change) may not carry it
        // yet, so re-sync and force a token refresh when it drifts.
        try {
          const tokenResult = await firebaseUser.getIdTokenResult();
          if (tokenResult.claims.companyId !== (existingUser.companyId || "")) {
            const refreshClaims = httpsCallable<Record<string, never>, unknown>(
              functions,
              "refreshMyClaims"
            );
            await refreshClaims({});
            await firebaseUser.getIdToken(true);
          }
        } catch (claimErr) {
          console.error("Claim refresh failed", claimErr);
        }

        setAppUser(existingUser);
        setCompanyId(existingUser.companyId || null);

        if (existingUser.companyId) {
          const companyDoc = await getDocument<Company>(
            "companies",
            existingUser.companyId
          );
          setCompany(companyDoc);
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setUser, setAppUser, setCompanyId, setLoading, setCompany, setAlumniLoginRequired, logout]);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Google sign-in error:", error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
    } catch (error) {
      console.error("Email sign-in error:", error);
      throw error;
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName: string
  ) => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.toLowerCase(), password);
      await updateProfile(credential.user, { displayName });
    } catch (error) {
      console.error("Email sign-up error:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      logout();
      setCompany(null);
    } catch (error) {
      console.error("Sign-out error:", error);
      throw error;
    }
  };

  const isHR = appUser?.role === "hr_admin" || appUser?.role === "super_admin";
  const isITAdmin = appUser?.role === "it_admin" || appUser?.role === "super_admin";
  const isManager = appUser?.role === "manager" || appUser?.role === "super_admin";

  return {
    user,
    appUser,
    company,
    companyId,
    loading,
    alumniLoginRequired,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    isHR,
    isITAdmin,
    isManager,
  };
}
