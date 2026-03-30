import { useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import { auth, googleProvider } from "../lib/firebase";
import { getDocument, setDocument, queryDocuments, updateDocument, where } from "../lib/firestore";
import { useAuthStore } from "../store/authStore";
import { useCompanyStore } from "../store/companyStore";
import type { AppUser } from "../types/user.types";
import type { Company } from "../types/company.types";

export function useAuth() {
  const { user, appUser, companyId, loading, setUser, setAppUser, setCompanyId, setLoading, logout } =
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

          // Check for a pending invite matching this email
          if (firebaseUser.email) {
            try {
              const invites = await queryDocuments<{
                id: string;
                companyId: string;
                role: AppUser["role"];
                status: string;
                expiresAt: Timestamp;
              }>("invites", [
                where("email", "==", firebaseUser.email.toLowerCase()),
                where("status", "==", "pending"),
              ]);
              const validInvite = invites.find(
                (inv) => inv.expiresAt.toDate() > new Date()
              );
              if (validInvite) {
                newUser.companyId = validInvite.companyId;
                newUser.role = validInvite.role;
                await updateDocument("invites", validInvite.id, {
                  status: "accepted",
                });
              }
            } catch {
              // Non-fatal: proceed with no company assignment
            }
          }

          await setDocument("users", firebaseUser.uid, newUser);
          existingUser = newUser;
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
  }, [setUser, setAppUser, setCompanyId, setLoading, setCompany, logout]);

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
      await signInWithEmailAndPassword(auth, email, password);
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
      const credential = await createUserWithEmailAndPassword(auth, email, password);
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
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    isHR,
    isITAdmin,
    isManager,
  };
}
