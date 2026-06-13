import clsx from "clsx";
import { ENGAGEMENT_LEVEL_CONFIG } from "../../types/alumni.types";
import type { EngagementLevel } from "../../types/alumni.types";

interface Props {
  score: number | null;
  level: EngagementLevel | null;
  showScore?: boolean;
  size?: 'sm' | 'md';
}

export default function EngagementBadge({ score, level, showScore = false, size = 'sm' }: Props) {
  if (score === null || level === null) {
    return <span className="text-xs text-mist">—</span>;
  }

  const config = ENGAGEMENT_LEVEL_CONFIG[level];

  return (
    <span className={clsx(
      "inline-flex items-center gap-1.5 rounded-full font-medium",
      size === 'sm' ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
      config.color,
    )}>
      <span className={clsx(
        "rounded-full flex-shrink-0",
        size === 'sm' ? "w-1.5 h-1.5" : "w-2 h-2",
        config.dot,
      )} />
      {config.label}
      {showScore && <span className="opacity-70">· {score}</span>}
    </span>
  );
}
