import clsx from "clsx";

interface ProgressProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  color?: "teal" | "ember" | "amber" | "navy";
  className?: string;
}

const sizeStyles = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

const colorStyles = {
  teal: "bg-teal",
  ember: "bg-ember",
  amber: "bg-amber-500",
  navy: "bg-navy",
};

export function Progress({
  value,
  max = 100,
  size = "md",
  color = "teal",
  className,
}: ProgressProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      className={clsx(
        "w-full bg-navy/10 rounded-full overflow-hidden",
        sizeStyles[size],
        className
      )}
    >
      <div
        className={clsx(
          "h-full rounded-full transition-all duration-300",
          colorStyles[color]
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
