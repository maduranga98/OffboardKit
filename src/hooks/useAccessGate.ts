import { useCallback, useEffect } from "react";
import { getAccessState } from "../lib/access";
import { getDocument } from "../lib/firestore";
import { useAuthStore } from "../store/authStore";
import { useCompanyStore } from "../store/companyStore";
import type { Company } from "../types/company.types";

/**
 * Subscription lock for the whole app.
 *
 * `useAuth` reads the company document once at sign-in, so a company that
 * subscribes (or whose trial lapses mid-session) would otherwise keep the
 * stale answer until a reload. This hook re-reads it whenever the tab is
 * brought back into focus — which is exactly the moment someone returns
 * from Stripe Checkout — and re-derives the lock on every render so the
 * trial deadline takes effect the second it passes.
 */
export function useAccessGate() {
  const company = useCompanyStore((s) => s.company);
  const setCompany = useCompanyStore((s) => s.setCompany);
  const companyId = useAuthStore((s) => s.companyId);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    try {
      const fresh = await getDocument<Company>("companies", companyId);
      if (fresh) setCompany(fresh);
    } catch (err) {
      // A failed refresh must never tighten the gate — keep the last known
      // state rather than locking someone out over a dropped connection.
      console.error("Company refresh failed", err);
    }
  }, [companyId, setCompany]);

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return { ...getAccessState(company), company, refresh };
}
