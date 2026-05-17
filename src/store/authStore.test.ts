import { describe, it, expect, beforeEach } from "vitest";
import type { User } from "firebase/auth";
import type { AppUser } from "../types/user.types";
import { useAuthStore } from "./authStore";

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      appUser: null,
      companyId: null,
      loading: true,
    });
  });

  it("starts with loading=true and empty user state", () => {
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.appUser).toBeNull();
    expect(s.companyId).toBeNull();
    expect(s.loading).toBe(true);
  });

  it("setUser updates only the user field", () => {
    const fakeUser = { uid: "u1" } as User;
    useAuthStore.getState().setUser(fakeUser);
    expect(useAuthStore.getState().user).toBe(fakeUser);
    expect(useAuthStore.getState().appUser).toBeNull();
  });

  it("setAppUser, setCompanyId, setLoading update independently", () => {
    const appUser = { id: "u1", role: "hr_admin" } as unknown as AppUser;
    useAuthStore.getState().setAppUser(appUser);
    useAuthStore.getState().setCompanyId("co1");
    useAuthStore.getState().setLoading(false);
    const s = useAuthStore.getState();
    expect(s.appUser).toBe(appUser);
    expect(s.companyId).toBe("co1");
    expect(s.loading).toBe(false);
  });

  it("logout clears identity fields and ends loading", () => {
    useAuthStore.getState().setUser({ uid: "u1" } as User);
    useAuthStore.getState().setCompanyId("co1");
    useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.appUser).toBeNull();
    expect(s.companyId).toBeNull();
    expect(s.loading).toBe(false);
  });
});
