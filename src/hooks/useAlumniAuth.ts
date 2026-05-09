import { useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { queryDocuments, where } from "../lib/firestore";
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
    setAuthError,
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

        if (alumni.length === 0) {
          await firebaseSignOut(auth);
          setAuthError("No alumni account found with this email. Please check your email address.");
          logout();
        } else if (!alumni[0].optedIn) {
          await firebaseSignOut(auth);
          setAuthError("Your alumni account has not been activated. Please contact your former company.");
          logout();
        } else {
          setAlumniProfile(alumni[0]);
          setAuthError(null);
        }
      } catch (error) {
        console.error("Error loading alumni profile:", error);
        setAuthError("Something went wrong. Please try again later.");
        logout();
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setUser, setAlumniProfile, setLoading, logout]);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setAuthError(null);
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will validate the alumni profile exists
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
    authError,
    signInWithEmail,
    signOut,
  };
}
