import { useEffect } from "react";import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, functions, googleProvider } from "../lib/firebase";
import { getDocument, setDocument, queryDocuments, where } from "../lib/firestore";
import { useAuthStore } from "../store/authStore";
import { useCompanyStore } from "../store/companyStore";
import type { AppUser } from "../types/user.types";
import type { Company } from "../types/company.types";

export function useAuth() {
  const { user, appUser, companyId, loading, alumniLoginRequired, setUser, setAppUser, setCompanyId, setLoading, setAlumniLoginRequired, logout } =
    useAuthStore();
  const { setCompany } = useCompanyStore();
  const company = useCompanyStore((s) => s.company);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        logout();
        setCompany(null);
        return;
      }

      setUser(firebaseUser);

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
                await firebaseSignOut(auth);
                setAlumniLoginRequired(true);
                setLoading(false);
                return;
              }
            } catch {
              // Non-blocking: proceed with normal company user creation
            }
          }

          // companyId and role are intentionally omitted here — security rules
          // reject any client write to those fields. Membership is granted
          // server-side by claimCompany (setup wizard) or acceptInvite below.
          const newUser: AppUser = {
            id: firebaseUser.uid,
            companyId: "",
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || "",
            photoURL: firebaseUser.photoURL || "",
            role: "super_admin",
            department: "",
            isActive: true,
            lastLoginAt: Timestamp.now(),
            createdAt: Timestamp.now(),
          };
          await setDocument("users", firebaseUser.uid, newUser);
          existingUser = newUser;
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
