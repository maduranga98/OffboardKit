import { useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { queryDocuments, updateDocument, where } from "../lib/firestore";
import { useAlumniAuthStore } from "../store/alumniAuthStore";
import type { AlumniProfile } from "../types/alumni.types";

export function useAlumniAuth() {
  const {
    user,
    alumniProfile,
    loading,
    authError,
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
        // Firebase Auth always reports the address in lower case, while a
        // profile is saved with whatever casing HR typed. Matching on the raw
        // value meant an alumni invited as "Jane.Doe@corp.com" finished the
        // password setup and was then told no account existed. Newer invites
        // normalise the stored address; the authUid written by sendAlumniInvite
        // is the fallback that rescues rows saved before that.
        const email = (firebaseUser.email || "").toLowerCase();
        let alumni = email
          ? await queryDocuments<AlumniProfile>("alumniProfiles", [
              where("email", "==", email),
            ])
          : [];

        if (alumni.length === 0) {
          alumni = await queryDocuments<AlumniProfile>("alumniProfiles", [
            where("authUid", "==", firebaseUser.uid),
          ]).catch(() => []);
        }

        if (alumni.length === 0) {
          setAuthError("No alumni account found with this email. Please check your email address.");
          await firebaseSignOut(auth);
        } else if (!alumni[0].optedIn) {
          setAuthError("Your alumni account has not been activated. Please contact your former company.");
          await firebaseSignOut(auth);
        } else {
          const profile = alumni[0];
          // Link the Firebase Auth UID if not already set
          if (!profile.authUid && firebaseUser.uid) {
            try {
              await updateDocument("alumniProfiles", profile.id, { authUid: firebaseUser.uid });
            } catch {
              // Non-blocking: profile still works without authUid
            }
          }
          setAlumniProfile({ ...profile, authUid: firebaseUser.uid });
          setAuthError(null);
        }
      } catch (error) {
        console.error("Error loading alumni profile:", error);
        setAuthError("Something went wrong. Please try again later.");
        await firebaseSignOut(auth);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setUser, setAlumniProfile, setLoading, setAuthError, logout]);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setAuthError(null);
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      // onAuthStateChanged will validate the alumni profile exists
    } catch (error) {
      console.error("Email sign-in error:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setAuthError(null);
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
    setAuthError,
    signInWithEmail,
    signOut,
  };
}
