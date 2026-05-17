import { describe, it, expect, beforeEach } from "vitest";
import type { User } from "firebase/auth";
import type { AlumniProfile } from "../types/alumni.types";
import { useAlumniAuthStore } from "./alumniAuthStore";

describe("alumniAuthStore", () => {
  beforeEach(() => {
    useAlumniAuthStore.setState({
      user: null,
      alumniProfile: null,
      loading: true,
      authError: null,
    });
  });

  it("has the expected initial state", () => {
    const s = useAlumniAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.alumniProfile).toBeNull();
    expect(s.loading).toBe(true);
    expect(s.authError).toBeNull();
  });

  it("setters update fields independently", () => {
    const user = { uid: "a1" } as User;
    const profile = { id: "a1" } as unknown as AlumniProfile;
    useAlumniAuthStore.getState().setUser(user);
    useAlumniAuthStore.getState().setAlumniProfile(profile);
    useAlumniAuthStore.getState().setLoading(false);
    useAlumniAuthStore.getState().setAuthError("nope");
    const s = useAlumniAuthStore.getState();
    expect(s.user).toBe(user);
    expect(s.alumniProfile).toBe(profile);
    expect(s.loading).toBe(false);
    expect(s.authError).toBe("nope");
  });

  it("logout wipes user/profile and stops loading but preserves authError", () => {
    useAlumniAuthStore.getState().setUser({ uid: "a1" } as User);
    useAlumniAuthStore.getState().setAuthError("bad-token");
    useAlumniAuthStore.getState().logout();
    const s = useAlumniAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.alumniProfile).toBeNull();
    expect(s.loading).toBe(false);
    // logout intentionally leaves authError alone so the login screen can
    // still surface why the previous session ended.
    expect(s.authError).toBe("bad-token");
  });
});
