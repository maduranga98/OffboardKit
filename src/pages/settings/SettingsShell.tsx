import { NavLink } from "react-router-dom";
import { Building, Users, CreditCard } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../../hooks/useAuth";

const navItems = [
  { label: "Company Profile", href: "/settings", icon: Building, roles: null },
  { label: "Team & Roles", href: "/settings/team", icon: Users, roles: ["super_admin", "hr_admin"] },
  { label: "Billing", href: "/settings/billing", icon: CreditCard, roles: ["super_admin"] },
];

function SettingsTabs() {
  const { appUser } = useAuth();
  const role = appUser?.role ?? "";

  const visibleItems = navItems.filter(
    (item) => item.roles === null || item.roles.includes(role)
  );

  return (
    // Full-bleed rail: the underline runs edge to edge while the tabs stay
    // aligned with the page content.
    <div className="sticky top-0 z-10 -mx-4 lg:-mx-6 bg-white/85 backdrop-blur-sm border-b border-navy/10">
      <nav
        aria-label="Settings sections"
        className="flex gap-1 overflow-x-auto scrollbar-hide px-4 lg:px-6"
      >
        {visibleItems.map(({ label, href, icon: Icon }) => (
          <NavLink
            key={href}
            to={href}
            end={href === "/settings"}
            className={({ isActive }) =>
              clsx(
                "group relative flex shrink-0 items-center gap-2 whitespace-nowrap",
                "px-3 py-3 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 rounded-t-md",
                isActive ? "text-teal" : "text-mist hover:text-navy"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={16}
                  className={clsx(
                    "shrink-0 transition-colors",
                    isActive ? "text-teal" : "text-mist group-hover:text-navy"
                  )}
                  aria-hidden="true"
                />
                {label}
                {/* Underline indicator sits on the rail's border */}
                <span
                  aria-hidden="true"
                  className={clsx(
                    "absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors",
                    isActive ? "bg-teal" : "bg-transparent group-hover:bg-navy/15"
                  )}
                />
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

interface SettingsShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsShell({ title, description, children }: SettingsShellProps) {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-display text-navy">{title}</h1>
        {description && <p className="text-sm text-mist mt-1">{description}</p>}
      </div>

      <SettingsTabs />

      <div className="mt-6 space-y-6 min-w-0">{children}</div>
    </div>
  );
}
