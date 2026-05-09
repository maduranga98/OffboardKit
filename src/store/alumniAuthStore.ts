import { create } from "zustand";
import type { User } from "firebase/auth";
import type { AlumniProfile } from "../types/alumni.types";

interface AlumniAuthState {
  user: User | null;
  alumniProfile: AlumniProfile | null;
  loading: boolean;
  authError: string | null;
  setUser: (user: User | null) => void;
  setAlumniProfile: (profile: AlumniProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setAuthError: (error: string | null) => void;
  logout: () => void;
}

export const useAlumniAuthStore = create<AlumniAuthState>((set) => ({
  user: null,
  alumniProfile: null,
  loading: true,
  authError: null,
  setUser: (user) => set({ user }),
  setAlumniProfile: (alumniProfile) => set({ alumniProfile }),
  setLoading: (loading) => set({ loading }),
  setAuthError: (authError) => set({ authError }),
  logout: () => set({ user: null, alumniProfile: null, loading: false }),
}));
