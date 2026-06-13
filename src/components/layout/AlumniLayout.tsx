import { useState, useEffect } from "react";
import { Outlet, Navigate, useNavigate, NavLink } from "react-router-dom";
import { LogOut, Briefcase, User, Megaphone } from "lucide-react";
import { useAlumniAuth } from "../../hooks/useAlumniAuth";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { queryDocuments, where } from "../../lib/firestore";
import type { AlumniAnnouncement } from "../../types/alumniAnnouncements";
import type { AlumniAnnouncementRead } from "../../types/alumniAnnouncements";
import logo from "../../assets/logo.png";

const NAV_ITEMS = [
  { to: "/alumni-portal/profile", icon: User,      label: "Profile"  },
  { to: "/alumni-portal/jobs",    icon: Briefcase,  label: "Jobs"     },
  { to: "/alumni-portal/updates", icon: Megaphone,  label: "Updates"  },
] as const;

export default function AlumniLayout() {
  const { user, alumniProfile, loading, signOut } = useAlumniAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!alumniProfile) return;
    let cancelled = false;
    async function fetchUnread() {
      try {
        const [published, reads] = await Promise.all([
          queryDocuments<AlumniAnnouncement>("alumniAnnouncements", [
            where("companyId", "==", alumniProfile!.companyId),
            where("status", "==", "published"),
          ]),
          queryDocuments<AlumniAnnouncementRead>("alumniAnnouncementReads", [
            where("alumniId", "==", alumniProfile!.id),
          ]),
        ]);
        if (cancelled) return;
        const readSet = new Set(reads.map((r) => r.announcementId));
        const visible = published.filter((a) =>
          a.audience === "all" || alumniProfile!.optedIn === true
        );
        setUnreadCount(visible.filter((a) => !readSet.has(a.id)).length);
      } catch { /* ignore */ }
    }
    fetchUnread();
    return () => { cancelled = true; };
  }, [alumniProfile]);

  if (loading) return <LoadingSpinner fullScreen />;
  if (!user || !alumniProfile) return <Navigate to="/alumni-login" replace />;

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/alumni-login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-warm flex flex-col">
      {/* ── Top header ── */}
      <header className="bg-white border-b border-navy/5 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="h-14 sm:h-16 flex items-center justify-between gap-4">

            {/* Logo */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <img src={logo} alt="OffboardSet" className="w-7 h-7 object-contain" />
              <span className="font-display text-base sm:text-lg text-navy hidden xs:block">
                OffboardSet
              </span>
            </div>

            {/* Desktop nav (sm+) */}
            <nav className="hidden sm:flex items-center gap-0.5">
              {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      isActive ? "bg-navy/5 text-navy" : "text-mist hover:text-navy hover:bg-navy/3"
                    }`
                  }
                >
                  <Icon size={14} />
                  {label}
                  {label === "Updates" && unreadCount > 0 && (
                    <span className="ml-0.5 text-xs bg-teal text-white rounded-full px-1.5 py-px leading-none">
                      {unreadCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Right: avatar + logout */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-teal/10 flex items-center justify-center text-teal font-semibold text-xs uppercase">
                {alumniProfile.name.charAt(0)}
              </div>
              <span className="text-sm text-mist hidden md:block truncate max-w-[120px]">
                {alumniProfile.name}
              </span>
              <button
                onClick={handleLogout}
                className="p-1.5 text-mist hover:text-navy transition-colors rounded-lg hover:bg-navy/5"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 pb-24 sm:pb-8">
        <Outlet />
      </main>

      {/* ── Mobile bottom nav (hidden sm+) ── */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-navy/10 safe-area-pb">
        <div className="flex items-stretch h-16">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
                  isActive ? "text-teal" : "text-mist"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                    {label === "Updates" && unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 bg-teal text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </span>
                  <span className={isActive ? "text-teal" : "text-mist"}>{label}</span>
                  {isActive && (
                    <span className="absolute top-0 inset-x-0 h-0.5 bg-teal rounded-b-full" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Footer — desktop only */}
      <footer className="hidden sm:block border-t border-navy/5 py-6 mt-auto">
        <div className="max-w-3xl mx-auto px-6 text-center text-xs text-mist">
          © {new Date().getFullYear()} OffboardSet. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
