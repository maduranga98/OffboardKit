import { NavLink } from "react-router-dom";
import { Building, Users, CreditCard, Plug, Webhook } from "lucide-react";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { useAuth } from "../../hooks/useAuth";

const navItems = [
  { label: "Company Profile", href: "/settings", icon: Building, roles: null },
  { label: "Team & Roles", href: "/settings/team", icon: Users, roles: ["super_admin", "hr_admin"] },
  { label: "Billing", href: "/settings/billing", icon: CreditCard, roles: ["super_admin"] },
  { label: "Integrations", href: "/settings/integrations", icon: Plug, roles: ["super_admin", "hr_admin"] },
  { label: "HRIS Webhooks", href: "/settings/webhooks", icon: Webhook, roles: ["super_admin"] },
];

function SettingsSidebar() {
  const { appUser } = useAuth();
  const role = appUser?.role ?? "";

  const visibleItems = navItems.filter(
    (item) => item.roles === null || item.roles.includes(role)
  );

  return (
    <nav className="space-y-1">
      {visibleItems.map(({ label, href, icon: Icon }) => (
        <NavLink
          key={href}
          to={href}
          end={href === "/settings"}
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-teal/10 text-teal"
                : "text-mist hover:text-navy hover:bg-navy/5"
            )
          }
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

interface SettingsShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsShell({ title, description, children }: SettingsShellProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-navy">{title}</h1>
        {description && (
          <p className="text-sm text-mist mt-1">{description}</p>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-52 flex-shrink-0">
          <Card padding="sm">
            <SettingsSidebar />
          </Card>
        </div>
        <div className="flex-1 space-y-6 min-w-0">{children}</div>
      </div>
    </div>
  );
}
