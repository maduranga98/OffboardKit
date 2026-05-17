import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../lib/firebase", () => import("../test/mocks/firebase"));

const updateDocSpy = vi.fn(async (_ref: unknown, _data: unknown) => undefined);
const batchUpdate = vi.fn();
const batchCommit = vi.fn(async () => undefined);
const writeBatchSpy = vi.fn((_db: unknown) => ({
  update: batchUpdate,
  commit: batchCommit,
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db: unknown, coll: string, id: string) => ({ coll, id })),
  updateDoc: (ref: unknown, data: unknown) => updateDocSpy(ref, data),
  writeBatch: (db: unknown) => writeBatchSpy(db),
  serverTimestamp: () => "__server_ts__",
}));

import {
  useNotificationStore,
  type AppNotification,
} from "./notificationStore";

function makeNotif(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "n1",
    title: "t",
    body: "b",
    type: "system",
    link: "/x",
    icon: "bell",
    read: false,
    acked: false,
    escalated: false,
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

describe("notificationStore", () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [], unreadCount: 0 });
    updateDocSpy.mockClear();
    batchUpdate.mockClear();
    batchCommit.mockClear();
    writeBatchSpy.mockClear();
  });

  it("setNotifications recomputes unreadCount from the read flag", () => {
    useNotificationStore.getState().setNotifications([
      makeNotif({ id: "a", read: false }),
      makeNotif({ id: "b", read: true }),
      makeNotif({ id: "c", read: false }),
    ]);
    expect(useNotificationStore.getState().unreadCount).toBe(2);
  });

  it("markRead flips the notification, decrements unreadCount, and writes to firestore", async () => {
    useNotificationStore.getState().setNotifications([
      makeNotif({ id: "a", read: false }),
      makeNotif({ id: "b", read: false }),
    ]);
    await useNotificationStore.getState().markRead("a");
    const s = useNotificationStore.getState();
    expect(s.notifications.find((n) => n.id === "a")?.read).toBe(true);
    expect(s.unreadCount).toBe(1);
    expect(updateDocSpy).toHaveBeenCalledWith(
      { coll: "notifications", id: "a" },
      { isRead: true }
    );
  });

  it("markRead leaves local state unchanged when the notification is already read", async () => {
    useNotificationStore.getState().setNotifications([
      makeNotif({ id: "a", read: true }),
    ]);
    await useNotificationStore.getState().markRead("a");
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
  });

  it("markRead leaves local state unchanged for unknown ids", async () => {
    useNotificationStore.getState().setNotifications([
      makeNotif({ id: "a", read: false }),
    ]);
    await useNotificationStore.getState().markRead("missing");
    expect(useNotificationStore.getState().unreadCount).toBe(1);
    expect(useNotificationStore.getState().notifications[0].read).toBe(false);
  });

  it("markAllRead batches one update per unread notification", async () => {
    useNotificationStore.getState().setNotifications([
      makeNotif({ id: "a", read: false }),
      makeNotif({ id: "b", read: true }),
      makeNotif({ id: "c", read: false }),
    ]);
    await useNotificationStore.getState().markAllRead();
    const s = useNotificationStore.getState();
    expect(s.unreadCount).toBe(0);
    expect(s.notifications.every((n) => n.read)).toBe(true);
    expect(batchUpdate).toHaveBeenCalledTimes(2);
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it("markAllRead skips firestore entirely when nothing is unread", async () => {
    useNotificationStore.getState().setNotifications([
      makeNotif({ id: "a", read: true }),
    ]);
    await useNotificationStore.getState().markAllRead();
    expect(writeBatchSpy).not.toHaveBeenCalled();
  });

  it("acknowledge marks acked+read and writes ackedAt/ackedBy", async () => {
    useNotificationStore.getState().setNotifications([
      makeNotif({ id: "a", read: false }),
    ]);
    await useNotificationStore.getState().acknowledge("a", "user-1");
    const a = useNotificationStore.getState().notifications[0];
    expect(a.acked).toBe(true);
    expect(a.read).toBe(true);
    expect(updateDocSpy).toHaveBeenCalledWith(
      { coll: "notifications", id: "a" },
      { ackedAt: "__server_ts__", ackedBy: "user-1", isRead: true }
    );
  });

  it("local state still updates if firestore rejects (errors are swallowed)", async () => {
    updateDocSpy.mockRejectedValueOnce(new Error("offline"));
    useNotificationStore.getState().setNotifications([
      makeNotif({ id: "a", read: false }),
    ]);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await useNotificationStore.getState().markRead("a");
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
