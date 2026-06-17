import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  MessageSquare,
  BookOpen,
  Package,
  BarChart2,
  TrendingUp,
  Network,
  Settings,
  HelpCircle,
  X,
  LogOut,
  GitBranch,
  Briefcase,
  Megaphone,
  MessageCircle,
  BarChart3,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../../hooks/useAuth";
import { Badge } from "../ui/Badge";
import logo from "../../assets/logo.png";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const alumniSubItems = [
  { tab: "directory", label: "Directory", icon: Network },
  { tab: "pipeline", label: "Boomerang Pipeline", icon: GitBranch },
  { tab: "jobboard", label: "Job Board", icon: Briefcase },
  { tab: "announcements", label: "Announcements", icon: Megaphone },
  { tab: "expertthreads", label: "Expert Threads", icon: MessageCircle },
  { tab: "pulsesurveys", label: "Pulse Surveys", icon: BarChart3 },
  { tab: "consulting", label: "Consulting", icon: Users },
  { tab: "requests", label: "Requests", icon: FileText },
];

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/offboardings", label: "Offboardings", icon: Users },
  { to: "/assets", label: "Assets", icon: Package },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/knowledge", label: "Knowledge Base", icon: BookOpen },
  { to: "/analytics", label: "Analytics", icon: BarChart2 },
  { to: "/analytics/trends", label: "Trends", icon: TrendingUp },
  { to: "/interviews", label: "Exit Interviews", icon: MessageSquare },
  { to: "/alumni", label: "Alumni", icon: Network },
  { to: "/help", label: "Help", icon: HelpCircle },
];

function OffboardSetLogo() {
  return (
    <img src={logo} alt="OffboardSet Logo" className="w-7 h-7 object-contain" />
  );
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { appUser, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAlumniActive = location.pathname === "/alumni" || location.pathname.startsWith("/alumni/");
  const searchParams = new URLSearchParams(location.search);
  const activeAlumniTab = searchParams.get("tab") || "directory";

  const roleLabel = appUser?.role
    ? appUser.role.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "";

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-navy/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          "fixed top-0 left-0 h-full w-60 bg-navy flex flex-col z-50 transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <OffboardSetLogo />
            <span className="text-white font-display text-lg">
              Offboard<span className="text-teal">Set</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-mist hover:text-white lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {(() => {
            const activeTo = [...navItems]
              .sort((a, b) => b.to.length - a.to.length)
              .find(
                (i) =>
                  location.pathname === i.to ||
                  (i.to !== "/dashboard" &&
                    location.pathname.startsWith(i.to + "/")),
              )?.to;
            return navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTo === item.to;

            const isAlumniItem = item.to === "/alumni";
            return (
              <div key={item.to}>
                <NavLink
                  to={isAlumniItem ? "/alumni?tab=directory" : item.to}
                  onClick={isAlumniItem ? (e) => { e.preventDefault(); navigate("/alumni?tab=directory"); onClose(); } : onClose}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "text-teal bg-teal/10 border-l-2 border-teal"
                      : "text-mist hover:text-white hover:bg-teal/5 border-l-2 border-transparent",
                  )}
                >
                  <Icon size={18} />
                  <span className="flex-1">{item.label}</span>
                  {isAlumniItem && (isAlumniActive ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                </NavLink>
                {isAlumniItem && isAlumniActive && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-teal/20 pl-3">
                    {alumniSubItems.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = activeAlumniTab === sub.tab;
                      return (
                        <button
                          key={sub.tab}
                          onClick={() => { navigate(`/alumni?tab=${sub.tab}`); onClose(); }}
                          className={clsx(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                            isSubActive
                              ? "text-teal bg-teal/10"
                              : "text-mist hover:text-white hover:bg-teal/5"
                          )}
                        >
                          <SubIcon size={13} />
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          });
          })()}
        </nav>

        <div className="px-3 py-2 mb-2">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
              location.pathname.startsWith("/settings")
                ? "text-teal bg-teal/10 border-l-2 border-teal"
                : "text-mist hover:text-white hover:bg-teal/5 border-l-2 border-transparent",
            )}
          >
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>
        </div>

        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-teal/20 flex items-center justify-center text-teal text-sm font-medium flex-shrink-0">
              {appUser?.displayName?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">
                {appUser?.displayName || "User"}
              </p>
              <Badge variant="teal" className="mt-0.5">
                {roleLabel}
              </Badge>
            </div>
            <button
              onClick={signOut}
              className="text-mist hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
