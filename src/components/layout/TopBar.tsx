import { Menu } from "lucide-react";
import { NotificationBell } from "../shared/NotificationBell";
import { useAuth } from "../../hooks/useAuth";

interface TopBarProps {
  title: string;
  onMenuClick: () => void;
}

export function TopBar({ title, onMenuClick }: TopBarProps) {
  const { appUser } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#E2E8F0]">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="p-2 text-mist hover:text-navy transition-colors lg:hidden"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-lg font-semibold text-navy">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
          <div className="h-8 w-8 rounded-full bg-teal/10 flex items-center justify-center text-teal text-sm font-medium">
            {appUser?.photoURL ? (
              <img
                src={appUser.photoURL}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              appUser?.displayName?.charAt(0)?.toUpperCase() || "U"
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
