import { Star } from "lucide-react";
import clsx from "clsx";

interface StarRatingProps {
  /** Filled star count (0–max). */
  score: number;
  /** Total stars rendered. Defaults to 5. */
  max?: number;
  size?: number;
  className?: string;
}

/**
 * Compact, read-only star rating rendered with icons.
 */
export function StarRating({ score, max = 5, size = 14, className }: StarRatingProps) {
  const filled = Math.max(0, Math.min(max, Math.round(score)));

  return (
    <span
      className={clsx("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${filled} out of ${max}`}
    >
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={size}
          aria-hidden="true"
          className={i < filled ? "fill-current" : "opacity-30"}
        />
      ))}
    </span>
  );
}
