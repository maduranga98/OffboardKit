import { useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "./useAuth";
import { useNotificationStore, type AppNotification } from "../store/notificationStore";

export function useNotifications() {
  const { user, companyId } = useAuth();
  const { setNotifications } = useNotificationStore();

  const uid = user?.uid;

  useEffect(() => {
    // Wait for the membership, not just the sign-in.
    //
    // onAuthStateChanged sets the Firebase user immediately, but the
    // companyId only lands after the users/{uid} read (and, for an invited
    // teammate, the acceptInvite callable) resolves. Attaching in that window
    // asks Firestore to read notifications before the rules can see a company
    // for this account, which they refuse — and an onSnapshot error tears the
    // listener down for good, so notifications stayed empty for the rest of
    // the session. Keying the effect on companyId attaches once, after the
    // membership is known, and re-attaches if it ever changes.
    if (!uid || !companyId) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      // Matches the tenant check in firestore.rules exactly: a query that can
      // reach another company's document is rejected wholesale rather than
      // filtered, so the constraint belongs here and not only in the rules.
      where("companyId", "==", companyId),
      where("userId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(30)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifications: AppNotification[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || "",
            body: data.message || "",
            type: data.type || "",
            link: data.link || "",
            icon: mapTypeToIcon(data.type),
            read: data.isRead === true,
            acked: !!data.ackedAt,
            escalated: !!data.escalatedAt,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          };
        });
        setNotifications(notifications);
      },
      (error) => {
        // The listener is dead once this fires; leave the bell empty rather
        // than showing a stale list from a previous membership.
        setNotifications([]);
        console.error("Notification listener error:", error);
      }
    );

    return () => unsubscribe();
  }, [uid, companyId, setNotifications]);
}

function mapTypeToIcon(type: string): string {
  switch (type) {
    case "offboarding_started":
      return "user-plus";
    case "task_overdue":
      return "alert-triangle";
    case "risk_flag":
      return "alert-circle";
    case "task_assigned":
      return "clipboard";
    case "knowledge_review":
      return "book-open";
    case "exit_interview_submitted":
      return "message-square";
    default:
      return "bell";
  }
}
