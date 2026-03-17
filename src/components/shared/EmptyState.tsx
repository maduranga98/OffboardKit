import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-mist mb-4">
        {icon || <Inbox size={48} strokeWidth={1.5} />}
      </div>
      <h3 className="text-lg font-medium text-navy mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-mist max-w-sm mb-6">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
