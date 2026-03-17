import { createBrowserRouter, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/auth/Login";
import SetupWizard from "./pages/auth/SetupWizard";
import Dashboard from "./pages/dashboard/Dashboard";
import OffboardingList from "./pages/offboardings/OffboardingList";
import TemplateList from "./pages/templates/TemplateList";
import Analytics from "./pages/analytics/Analytics";
import Settings from "./pages/settings/Settings";
import PortalEntry from "./pages/portal/PortalEntry";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/setup", element: <SetupWizard /> },
  { path: "/portal", element: <PortalEntry /> }, // No auth
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "offboardings", element: <OffboardingList /> },
      { path: "templates", element: <TemplateList /> },
      { path: "analytics", element: <Analytics /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);
