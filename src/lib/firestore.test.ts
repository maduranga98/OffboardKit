import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./firebase", () => import("../test/mocks/firebase"));

const mocks = vi.hoisted(() => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn((f, op, v) => ({ kind: "where", f, op, v })),
  orderBy: vi.fn((f, dir) => ({ kind: "orderBy", f, dir })),
  limit: vi.fn((n) => ({ kind: "limit", n })),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => "__ts__"),
}));

vi.mock("firebase/firestore", () => mocks);

import {
  getDocument,
  setDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  subscribeToDocument,
  subscribeToCollection,
  where,
  orderBy,
  limit,
} from "./firestore";

describe("firestore wrappers", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => "mockClear" in m && m.mockClear());
    mocks.doc.mockImplementation((_db, coll, id) => ({ ref: `${coll}/${id}` }));
    mocks.collection.mockImplementation((_db, coll) => ({ coll }));
    mocks.query.mockImplementation((c, ...cs) => ({ c, cs }));
  });

  describe("getDocument", () => {
    it("returns the document with its id merged in when found", async () => {
      mocks.getDoc.mockResolvedValueOnce({
        exists: () => true,
        id: "abc",
        data: () => ({ name: "Acme" }),
      });
      const result = await getDocument<{ id: string; name: string }>(
        "companies",
        "abc"
      );
      expect(result).toEqual({ id: "abc", name: "Acme" });
      expect(mocks.doc).toHaveBeenCalledWith(expect.anything(), "companies", "abc");
    });

    it("returns null when the document does not exist", async () => {
      mocks.getDoc.mockResolvedValueOnce({ exists: () => false });
      expect(await getDocument("companies", "missing")).toBeNull();
    });

    it("rethrows underlying errors after logging", async () => {
      mocks.getDoc.mockRejectedValueOnce(new Error("boom"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      await expect(getDocument("companies", "abc")).rejects.toThrow("boom");
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  it("setDocument forwards data to setDoc with the right ref", async () => {
    mocks.setDoc.mockResolvedValueOnce(undefined);
    await setDocument("companies", "c1", { name: "Acme" });
    expect(mocks.setDoc).toHaveBeenCalledWith(
      { ref: "companies/c1" },
      { name: "Acme" }
    );
  });

  it("updateDocument forwards partial data to updateDoc", async () => {
    mocks.updateDoc.mockResolvedValueOnce(undefined);
    await updateDocument("companies", "c1", { name: "New" });
    expect(mocks.updateDoc).toHaveBeenCalledWith(
      { ref: "companies/c1" },
      { name: "New" }
    );
  });

  it("deleteDocument forwards the ref to deleteDoc", async () => {
    mocks.deleteDoc.mockResolvedValueOnce(undefined);
    await deleteDocument("companies", "c1");
    expect(mocks.deleteDoc).toHaveBeenCalledWith({ ref: "companies/c1" });
  });

  describe("queryDocuments", () => {
    it("composes constraints, runs the query, and maps id+data", async () => {
      mocks.getDocs.mockResolvedValueOnce({
        docs: [
          { id: "1", data: () => ({ n: "a" }) },
          { id: "2", data: () => ({ n: "b" }) },
        ],
      });
      const constraints = [where("plan", "==", "free"), orderBy("name"), limit(10)];
      const result = await queryDocuments<{ id: string; n: string }>(
        "companies",
        constraints
      );
      expect(result).toEqual([
        { id: "1", n: "a" },
        { id: "2", n: "b" },
      ]);
      expect(mocks.collection).toHaveBeenCalledWith(expect.anything(), "companies");
      expect(mocks.query).toHaveBeenCalledWith(
        { coll: "companies" },
        ...constraints
      );
    });

    it("returns an empty array for an empty result set", async () => {
      mocks.getDocs.mockResolvedValueOnce({ docs: [] });
      expect(await queryDocuments("companies", [])).toEqual([]);
    });
  });

  describe("subscribe helpers", () => {
    it("subscribeToDocument fires callback(null) when the doc is missing", () => {
      const cb = vi.fn();
      mocks.onSnapshot.mockImplementationOnce((_ref, handler) => {
        handler({ exists: () => false });
        return () => {};
      });
      subscribeToDocument("companies", "c1", cb);
      expect(cb).toHaveBeenCalledWith(null);
    });

    it("subscribeToDocument fires callback with id+data when present", () => {
      const cb = vi.fn();
      mocks.onSnapshot.mockImplementationOnce((_ref, handler) => {
        handler({ exists: () => true, id: "c1", data: () => ({ n: "Acme" }) });
        return () => {};
      });
      subscribeToDocument("companies", "c1", cb);
      expect(cb).toHaveBeenCalledWith({ id: "c1", n: "Acme" });
    });

    it("subscribeToDocument returns the unsubscribe function from onSnapshot", () => {
      const unsub = vi.fn();
      mocks.onSnapshot.mockReturnValueOnce(unsub);
      const result = subscribeToDocument("companies", "c1", vi.fn());
      expect(result).toBe(unsub);
    });

    it("subscribeToCollection maps each doc to id+data", () => {
      const cb = vi.fn();
      mocks.onSnapshot.mockImplementationOnce((_q, handler) => {
        handler({
          docs: [
            { id: "1", data: () => ({ n: "a" }) },
            { id: "2", data: () => ({ n: "b" }) },
          ],
        });
        return () => {};
      });
      subscribeToCollection("companies", [], cb);
      expect(cb).toHaveBeenCalledWith([
        { id: "1", n: "a" },
        { id: "2", n: "b" },
      ]);
    });
  });
});
