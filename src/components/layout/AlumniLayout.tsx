import { Outlet, Navigate, useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { useAlumniAuth } from "../../hooks/useAlumniAuth";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import logo from "../../assets/logo.png";

export default function AlumniLayout() {
  const { user, alumniProfile, loading, signOut } = useAlumniAuth();
  const navigate = useNavigate();

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
            <div className="flex items-center gap-2 cursor-pointer">
              <img
                src={logo}
                alt="OffboardKit"
                className="w-8 h-8 object-contain"
              />
              <span className="font-display text-lg text-navy">OffboardKit</span>
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
          <p>© {new Date().getFullYear()} OffboardKit. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
