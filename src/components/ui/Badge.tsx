import type { ReactNode } from "react";
import clsx from "clsx";

type BadgeVariant = "teal" | "navy" | "ember" | "mist" | "warm" | "amber";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  teal: "bg-teal/10 text-teal",
  navy: "bg-navy/10 text-navy",
  ember: "bg-ember/10 text-ember",
  mist: "bg-mist/10 text-mist",
  warm: "bg-warm text-navy",
  amber: "bg-amber-100 text-amber-800",
};

export function Badge({ children, variant = "teal", className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
