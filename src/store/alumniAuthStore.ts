import { create } from "zustand";
import type { User } from "firebase/auth";
import type { AlumniProfile } from "../types/alumni.types";

interface AlumniAuthState {
  user: User | null;
  alumniProfile: AlumniProfile | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setAlumniProfile: (profile: AlumniProfile | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAlumniAuthStore = create<AlumniAuthState>((set) => ({
  user: null,
  alumniProfile: null,
  loading: true,
  setUser: (user) => set({ user }),
  setAlumniProfile: (alumniProfile) => set({ alumniProfile }),
  setLoading: (loading) => set({ loading }),
  logout: () => set({ user: null, alumniProfile: null, loading: false }),
}));
