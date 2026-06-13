import { create } from "zustand";
import type { User } from "firebase/auth";
import type { AppUser } from "../types/user.types";

interface AuthState {
  user: User | null;
  appUser: AppUser | null;
  companyId: string | null;
  loading: boolean;
  alumniLoginRequired: boolean;
  setUser: (user: User | null) => void;
  setAppUser: (appUser: AppUser | null) => void;
  setCompanyId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setAlumniLoginRequired: (v: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  appUser: null,
  companyId: null,
  loading: true,
  alumniLoginRequired: false,
  setUser: (user) => set({ user }),
  setAppUser: (appUser) => set({ appUser }),
  setCompanyId: (companyId) => set({ companyId }),
  setLoading: (loading) => set({ loading }),
  setAlumniLoginRequired: (alumniLoginRequired) => set({ alumniLoginRequired }),
  logout: () => set({ user: null, appUser: null, companyId: null, loading: false }),
}));
