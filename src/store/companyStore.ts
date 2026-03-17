import { create } from "zustand";
import type { Company } from "../types/company.types";

interface CompanyState {
  company: Company | null;
  loading: boolean;
  setCompany: (company: Company | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  company: null,
  loading: false,
  setCompany: (company) => set({ company }),
  setLoading: (loading) => set({ loading }),
}));
