import { create } from "zustand";
import { doc, updateDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  link: string;
  icon: string;
  read: boolean;
  // Acks are stronger than "read" — they signal "someone is taking
  // responsibility for this." Escalation skips acked items.
  acked: boolean;
  escalated: boolean;
  createdAt: Date;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  setNotifications: (notifications: AppNotification[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  acknowledge: (id: string, userId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    }),

  markRead: async (id) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      if (!notification || notification.read) return state;
      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    });

    try {
      await updateDoc(doc(db, "notifications", id), { isRead: true });
    } catch (error) {
      console.error("Failed to mark notification read:", error);
    }
  },

  markAllRead: async () => {
    const { notifications } = get();
    const unread = notifications.filter((n) => !n.read);

    if (unread.length === 0) return;

    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));

    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, "notifications", n.id), { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Failed to mark all notifications read:", error);
    }
  },

  acknowledge: async (id, userId) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, acked: true, read: true } : n
      ),
      unreadCount: state.notifications.find((n) => n.id === id && !n.read)
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount,
    }));
    try {
      await updateDoc(doc(db, "notifications", id), {
        ackedAt: serverTimestamp(),
        ackedBy: userId,
        isRead: true,
      });
    } catch (error) {
      console.error("Failed to acknowledge notification:", error);
    }
  },
}));
