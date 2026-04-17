import { useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { getDocument, queryDocuments, where } from "../lib/firestore";
import { useAlumniAuthStore } from "../store/alumniAuthStore";
import type { AlumniProfile } from "../types/alumni.types";

export function useAlumniAuth() {
  const {
    user,
    alumniProfile,
    loading,
    setUser,
    setAlumniProfile,
    setLoading,
    logout,
  } = useAlumniAuthStore();

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        logout();
        return;
      }

      setUser(firebaseUser);

      try {
        const alumni = await queryDocuments<AlumniProfile>(
          "alumniProfiles",
          [where("email", "==", firebaseUser.email || "")]
        );

        if (alumni.length > 0) {
          setAlumniProfile(alumni[0]);
        } else {
          logout();
        }
      } catch (error) {
        console.error("Error loading alumni profile:", error);
        logout();
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setUser, setAlumniProfile, setLoading, logout]);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      // Check if alumni exists first
      const alumni = await queryDocuments<AlumniProfile>(
        "alumniProfiles",
        [where("email", "==", email)]
      );

      if (alumni.length === 0) {
        throw new Error(
          "No alumni account found with this email. Please check your email address."
        );
      }

      if (!alumni[0].optedIn) {
        throw new Error(
          "Your alumni account has not been activated. Please contact your former company."
        );
      }

      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Email sign-in error:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      logout();
    } catch (error) {
      console.error("Sign-out error:", error);
      throw error;
    }
  };

  return {
    user,
    alumniProfile,
    loading,
    signInWithEmail,
    signOut,
  };
}
