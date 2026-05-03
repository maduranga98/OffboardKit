import { createBrowserRouter, Navigate, useRouteError } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import AlumniLayout from "./components/layout/AlumniLayout";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import SetupWizard from "./pages/auth/SetupWizard";
import AlumniLogin from "./pages/auth/AlumniLogin";
import Dashboard from "./pages/dashboard/Dashboard";
import OffboardingList from "./pages/offboardings/OffboardingList";
import OffboardingDetail from "./pages/offboardings/OffboardingDetail";
import NewOffboarding from "./pages/offboardings/NewOffboarding";
import TemplateList from "./pages/templates/TemplateList";
import TemplateDetail from "./pages/templates/TemplateDetail";
import Interviews from "./pages/interviews/Interviews";
import KnowledgeBase from "./pages/knowledge/KnowledgeBase";
import KnowledgeGaps from "./pages/knowledge/KnowledgeGaps";
import Analytics from "./pages/analytics/Analytics";
import Alumni from "./pages/alumni/Alumni";
import AlumniProfile from "./pages/alumni/AlumniProfile";
import Settings from "./pages/settings/Settings";
import TeamSettings from "./pages/settings/TeamSettings";
import BillingSettings from "./pages/settings/BillingSettings";
import IntegrationSettings from "./pages/settings/IntegrationSettings";
import PortalEntry from "./pages/portal/PortalEntry";

function NotFound() {
  const error = useRouteError() as { status?: number } | undefined;
  const is404 = !error || error.status === 404;
  return (
    <div className="min-h-screen flex items-center justify-center bg-warm/30 p-4">
      <div className="text-center">
        <p className="text-6xl font-display text-teal mb-4">
          {is404 ? "404" : "Error"}
        </p>
        <h1 className="text-xl font-semibold text-navy mb-2">
          {is404 ? "Page not found" : "Something went wrong"}
        </h1>
        <p className="text-sm text-mist mb-6">
          {is404
            ? "The page you're looking for doesn't exist."
            : "An unexpected error occurred."}
        </p>
        <a
          href="/dashboard"
          className="text-sm bg-teal text-white px-4 py-2 rounded-lg hover:bg-teal/90 transition-colors"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  // Public routes
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Signup /> },
  { path: "/portal/:token", element: <PortalEntry /> },
  { path: "/alumni-login", element: <AlumniLogin /> },

  // Setup route
  { path: "/setup", element: <SetupWizard /> },
  { path: "/portal", element: <PortalEntry /> },

  // Alumni portal routes
  {
    path: "/alumni-portal",
    element: <AlumniLayout />,
    children: [
      { index: true, element: <Navigate to="/alumni-portal/profile" replace /> },
      { path: "profile", element: <AlumniProfile /> },
    ],
  },
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "offboardings", element: <OffboardingList /> },
      { path: "offboardings/new", element: <NewOffboarding /> },
      { path: "offboardings/:id", element: <OffboardingDetail /> },
      { path: "templates", element: <TemplateList /> },
      { path: "templates/:id", element: <TemplateDetail /> },
      { path: "interviews", element: <Interviews /> },
      { path: "knowledge", element: <KnowledgeBase /> },
      { path: "knowledge/gaps", element: <KnowledgeGaps /> },
      { path: "analytics", element: <Analytics /> },
      { path: "alumni", element: <Alumni /> },
      { path: "settings", element: <Settings /> },
      { path: "settings/team", element: <TeamSettings /> },
      { path: "settings/billing", element: <BillingSettings /> },
      { path: "settings/integrations", element: <IntegrationSettings /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);
