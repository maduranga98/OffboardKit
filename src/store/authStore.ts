import { create } from "zustand";
import type { User } from "firebase/auth";
import type { AppUser } from "../types/user.types";

interface AuthState {
  user: User | null;
  appUser: AppUser | null;
  companyId: string | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setAppUser: (appUser: AppUser | null) => void;
  setCompanyId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  appUser: null,
  companyId: null,
  loading: true,
  setUser: (user) => set({ user }),
  setAppUser: (appUser) => set({ appUser }),
  setCompanyId: (companyId) => set({ companyId }),
  setLoading: (loading) => set({ loading }),
  logout: () => set({ user: null, appUser: null, companyId: null, loading: false }),
}));
