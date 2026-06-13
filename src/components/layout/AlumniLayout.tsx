import { useState, useEffect } from "react";
import { Outlet, Navigate, useNavigate, NavLink } from "react-router-dom";
import { LogOut, Briefcase, User, Megaphone } from "lucide-react";
import { useAlumniAuth } from "../../hooks/useAlumniAuth";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { queryDocuments, where } from "../../lib/firestore";
import type { AlumniAnnouncement } from "../../types/alumniAnnouncements";
import type { AlumniAnnouncementRead } from "../../types/alumniAnnouncements";
import logo from "../../assets/logo.png";

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
        const visible = published.filter((a) => {
          if (a.audience === "all") return true;
          return alumniProfile!.optedIn === true;
        });
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
    <div className="min-h-screen bg-warm">
      {/* Header */}
      <header className="bg-white border-b border-navy/5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <img
                  src={logo}
                  alt="OffboardSet"
                  className="w-8 h-8 object-contain"
                />
                <span className="font-display text-lg text-navy">OffboardSet</span>
              </div>
              <nav className="hidden sm:flex items-center gap-1">
                <NavLink
                  to="/alumni-portal/profile"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${isActive ? "bg-navy/5 text-navy" : "text-mist hover:text-navy"}`
                  }
                >
                  <User size={14} />
                  Profile
                </NavLink>
                <NavLink
                  to="/alumni-portal/jobs"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${isActive ? "bg-navy/5 text-navy" : "text-mist hover:text-navy"}`
                  }
                >
                  <Briefcase size={14} />
                  Jobs
                </NavLink>
                <NavLink
                  to="/alumni-portal/updates"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${isActive ? "bg-navy/5 text-navy" : "text-mist hover:text-navy"}`
                  }
                >
                  <span className="relative">
                    <Megaphone size={14} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-teal rounded-full" />
                    )}
                  </span>
                  Updates
                  {unreadCount > 0 && (
                    <span className="ml-0.5 text-xs bg-teal text-white rounded-full px-1.5 py-0.5 leading-none">
                      {unreadCount}
                    </span>
                  )}
                </NavLink>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-mist">{alumniProfile.name}</span>
              <div className="h-8 w-8 rounded-full bg-teal/10 flex items-center justify-center text-teal font-display text-xs">
                {alumniProfile.name.charAt(0)}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-mist hover:text-navy transition-colors"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-navy/5 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-mist">
          <p>© {new Date().getFullYear()} OffboardSet. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
