import { create } from "zustand";
import { User } from "firebase/auth";

interface AuthState {
  user: User | null;
  role: "super_admin" | "hr_admin" | "manager" | "it_admin" | null;
  companyId: string | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setRole: (role: AuthState["role"]) => void;
  setCompanyId: (id: string | null) => void;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  companyId: null,
  loading: true,
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setCompanyId: (companyId) => set({ companyId }),
  setLoading: (loading) => set({ loading }),
}));
