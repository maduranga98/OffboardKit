import { createBrowserRouter, Navigate } from "react-router-dom";
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
]);
