import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  BookOpen,
  BarChart2,
  Network,
  Settings,
  X,
  LogOut,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../../hooks/useAuth";
import { Badge } from "../ui/Badge";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/offboardings", label: "Offboardings", icon: Users },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/knowledge", label: "Knowledge Base", icon: BookOpen },
  { to: "/analytics", label: "Analytics", icon: BarChart2 },
  { to: "/alumni", label: "Alumni", icon: Network },
];

function OffboardKitLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      className="flex-shrink-0"
    >
      <rect width="28" height="28" rx="6" fill="#0D9E8A" />
      <path
        d="M7 8h8v12H7V8z"
        stroke="white"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M15 12l4 2-4 2"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M19 14h3"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { appUser, signOut } = useAuth();
  const location = useLocation();

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
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <OffboardKitLogo />
            <span className="text-white font-display text-lg">
              OffboardKit
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
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.to ||
              (item.to !== "/dashboard" &&
                location.pathname.startsWith(item.to));

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "text-teal bg-teal/10 border-l-2 border-teal"
                    : "text-mist hover:text-white hover:bg-teal/5 border-l-2 border-transparent"
                )}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 py-2 mb-2">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
              location.pathname.startsWith("/settings")
                ? "text-teal bg-teal/10 border-l-2 border-teal"
                : "text-mist hover:text-white hover:bg-teal/5 border-l-2 border-transparent"
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
