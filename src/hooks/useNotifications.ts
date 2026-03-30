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
  const { user } = useAuth();
  const { setNotifications } = useNotificationStore();

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
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
            createdAt: data.createdAt?.toDate?.() || new Date(),
          };
        });
        setNotifications(notifications);
      },
      (error) => {
        console.error("Notification listener error:", error);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, setNotifications]);
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
