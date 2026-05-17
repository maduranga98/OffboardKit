import { describe, it, expect, beforeEach } from "vitest";
import type { Company } from "../types/company.types";
import { useCompanyStore } from "./companyStore";

describe("companyStore", () => {
  beforeEach(() => {
    useCompanyStore.setState({ company: null, loading: false });
  });

  it("defaults to no company and loading=false", () => {
    const s = useCompanyStore.getState();
    expect(s.company).toBeNull();
    expect(s.loading).toBe(false);
  });

  it("setCompany stores the provided company", () => {
    const company = { id: "c1", name: "Acme", plan: "growth" } as unknown as Company;
    useCompanyStore.getState().setCompany(company);
    expect(useCompanyStore.getState().company).toBe(company);
  });

  it("setLoading toggles loading flag", () => {
    useCompanyStore.getState().setLoading(true);
    expect(useCompanyStore.getState().loading).toBe(true);
    useCompanyStore.getState().setLoading(false);
    expect(useCompanyStore.getState().loading).toBe(false);
  });
});
