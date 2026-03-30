import { create } from "zustand";
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  link: string;
  icon: string;
  read: boolean;
  createdAt: Date;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  setNotifications: (notifications: AppNotification[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
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
}));
