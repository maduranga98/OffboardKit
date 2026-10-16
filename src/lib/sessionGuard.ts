import { doc, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, db } from "./firebase";

/**
 * Signs this tab out the moment the account's sessions are revoked elsewhere
 * (the revokeOtherSessions function stamps sessionRevocations/{uid} after a
 * password change). Without this a stolen session would carry on until its ID
 * token expired; security rules already refuse its requests, this just makes
 * the client notice immediately.
 *
 * Returns an unsubscribe function.
 */
export function watchSessionRevocation(user: User): () => void {
  let stopped = false;
  let unsubscribe: (() => void) | null = null;

  user
    .getIdTokenResult()
    .then(({ claims }) => {
      if (stopped) return;
      const authTime = Number(claims.auth_time ?? 0);
      unsubscribe = onSnapshot(
        doc(db, "sessionRevocations", user.uid),
        (snap) => {
          const validAfter = Number(snap.data()?.validAfter ?? 0);
          if (snap.exists() && authTime < validAfter) {
            void signOut(auth);
          }
        },
        () => undefined
      );
    })
    .catch(() => undefined);

  return () => {
    stopped = true;
    unsubscribe?.();
  };
}
