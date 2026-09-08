import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  GoogleAuthProvider,
  connectAuthEmulator,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const secondaryApp = initializeApp(firebaseConfig, "secondary");

// Dedicated app for the unauthenticated exit portal / survey links. Portal
// visitors sign in with a flow-scoped custom token; keeping that on its own
// app means it never clobbers an HR user's session in the same browser, and
// in-memory persistence means the portal identity dies with the tab instead
// of lingering in localStorage on a shared machine.
const portalApp = initializeApp(firebaseConfig, "portal");

export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);
export const portalAuth = initializeAuth(portalApp, {
  persistence: inMemoryPersistence,
});
export const db = getFirestore(app);
export const portalDb = getFirestore(portalApp);
export const storage = getStorage(app);
export const portalStorage = getStorage(portalApp);
export const functions = getFunctions(app);
export const portalFunctions = getFunctions(portalApp);
export const googleProvider = new GoogleAuthProvider();

if (import.meta.env.DEV) {
  try {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    connectAuthEmulator(secondaryAuth, "http://localhost:9099", { disableWarnings: true });
    connectAuthEmulator(portalAuth, "http://localhost:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "localhost", 8080);
    connectFirestoreEmulator(portalDb, "localhost", 8080);
    connectStorageEmulator(storage, "localhost", 9199);
    connectStorageEmulator(portalStorage, "localhost", 9199);
    connectFunctionsEmulator(functions, "localhost", 5001);
    connectFunctionsEmulator(portalFunctions, "localhost", 5001);
  } catch {
    // Emulators already connected
  }
}
