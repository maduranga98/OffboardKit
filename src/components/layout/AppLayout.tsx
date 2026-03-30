import { useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { useAuth } from "../../hooks/useAuth";
import { useNotifications } from "../../hooks/useNotifications";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/offboardings": "Offboardings",
  "/templates": "Templates",
  "/interviews": "Interviews",
  "/knowledge": "Knowledge Base",
  "/analytics": "Analytics",
  "/alumni": "Alumni",
  "/settings": "Settings",
  "/settings/team": "Team Settings",
  "/settings/billing": "Billing",
  "/settings/integrations": "Integrations",
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading, companyId } = useAuth();
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

  const title =
    pageTitles[location.pathname] ||
    Object.entries(pageTitles).find(([path]) =>
      location.pathname.startsWith(path)
    )?.[1] ||
    "OffboardKit";

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
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
