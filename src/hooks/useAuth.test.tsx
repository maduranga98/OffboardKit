import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../lib/firebase", () => import("../test/mocks/firebase"));

const authMocks = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock("firebase/auth", () => authMocks);

const fnMocks = vi.hoisted(() => ({
  httpsCallable: vi.fn(() => vi.fn(async () => ({ data: { accepted: false } }))),
}));
vi.mock("firebase/functions", () => fnMocks);

const storeMocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  setDocument: vi.fn(async () => undefined),
  updateDocument: vi.fn(async () => undefined),
  queryDocuments: vi.fn(async () => []),
  where: vi.fn((f: string, op: string, v: unknown) => ({ f, op, v })),
}));
vi.mock("../lib/firestore", () => storeMocks);

vi.mock("firebase/firestore", () => ({
  Timestamp: { now: () => "__now__" },
}));

const UID = "uid-1";

const fakeUser = {
  uid: UID,
  email: "jane@acme.com",
  displayName: "Jane",
  photoURL: "",
  getIdTokenResult: async () => ({ claims: { email: "jane@acme.com", companyId: "c1" } }),
  getIdToken: async () => "tok",
};

/** Every subscriber gets the callback invoked, exactly as Firebase does. */
function armAuthListener() {
  authMocks.onAuthStateChanged.mockImplementation(
    (_auth: unknown, cb: (u: unknown) => void) => {
      Promise.resolve().then(() => cb(fakeUser));
      return () => {};
    }
  );
}

beforeEach(() => {
  vi.resetModules();
  armAuthListener();
  storeMocks.getDocument.mockImplementation(async (collectionName: string) =>
    collectionName === "users"
      ? { id: UID, companyId: "c1", email: "jane@acme.com", role: "hr_admin" }
      : { id: "c1", name: "Acme" }
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * AppLayout gates its children on `loading`, and those children (Sidebar,
 * TopBar, the routed page) call useAuth themselves. When the listener lived in
 * a useEffect, each child instance carried its own in-flight guard, re-ran the
 * resolution and pushed the shared `loading` back to true — which unmounted the
 * children mid-flight and started the whole thing again. The app never got past
 * the spinner.
 */
describe("useAuth listener", () => {
  it("settles with loading false when gated children also call useAuth", async () => {
    const { useAuth } = await import("./useAuth");

    function Child() {
      useAuth();
      return <div data-testid="child">child</div>;
    }

    function Layout() {
      const { loading } = useAuth();
      if (loading) return <div data-testid="spinner">loading</div>;
      return <Child />;
    }

    render(<Layout />);

    await waitFor(() => expect(screen.getByTestId("child")).toBeInTheDocument());

    // Give any re-entrant resolution a chance to flip `loading` back on.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("subscribes once and resolves the profile once, however many callers mount", async () => {
    const { useAuth } = await import("./useAuth");

    function Consumer() {
      useAuth();
      return null;
    }

    render(
      <>
        <Consumer />
        <Consumer />
        <Consumer />
      </>
    );

    await waitFor(() =>
      expect(
        storeMocks.getDocument.mock.calls.filter(([c]) => c === "users")
      ).toHaveLength(1)
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(authMocks.onAuthStateChanged).toHaveBeenCalledTimes(1);
    expect(
      storeMocks.getDocument.mock.calls.filter(([c]) => c === "users")
    ).toHaveLength(1);
  });
});
