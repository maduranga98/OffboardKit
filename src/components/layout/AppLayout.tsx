import { useState } from "react";
import { Outlet, Link, Navigate, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { TrialBanner } from "../shared/TrialBanner";
import { SubscriptionLock } from "../shared/SubscriptionLock";
import { useAuth } from "../../hooks/useAuth";
import { useAccessGate } from "../../hooks/useAccessGate";
import { useNotifications } from "../../hooks/useNotifications";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/offboardings": "Offboardings",
  "/assets": "Assets",
  "/templates": "Templates",
  "/interviews": "Interviews",
  "/knowledge": "Knowledge Base",
  "/analytics": "Analytics",
  "/alumni": "Alumni",
  "/settings": "Settings",
  "/settings/team": "Team Settings",
  "/settings/billing": "Billing",
};

/** The one route a locked company may still reach — it is the way out. */
const BILLING_ROUTE = "/settings/billing";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading, companyId } = useAuth();
  const { isLocked, lockedAfterTrial, refresh } = useAccessGate();
  const location = useLocation();

  useNotifications();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!companyId) {
    return <Navigate to="/setup" replace />;
  }

  // No trial, no subscription: the product stops. Billing stays reachable so
  // the company can buy its way back in; everything else is blocked here and,
  // independently, by firestore.rules — this screen is the explanation, not
  // the enforcement.
  if (isLocked && !location.pathname.startsWith(BILLING_ROUTE)) {
    return <SubscriptionLock afterTrial={lockedAfterTrial} onRefresh={refresh} />;
  }

  const title =
    pageTitles[location.pathname] ||
    Object.entries(pageTitles).find(([path]) =>
      location.pathname.startsWith(path)
    )?.[1] ||
    "OffboardSet";

  if (isLocked) {
    return (
      <div className="min-h-screen bg-warm/30">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-ember/20 bg-ember/5 px-4 py-2 text-sm">
          <Lock size={15} className="text-ember" aria-hidden />
          <span className="text-navy">
            OffboardKit is locked until you choose a plan.
          </span>
          <Link
            to="/dashboard"
            className="font-medium text-ember underline underline-offset-2 hover:no-underline"
          >
            What happened?
          </Link>
        </div>
        <main className="mx-auto max-w-5xl p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-warm/30">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <TrialBanner />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
