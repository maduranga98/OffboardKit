/**
 * Format a Date as "Month Day, Year" — e.g. "March 15, 2026"
 */
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a Date as "Mon Day" — e.g. "Mar 15"
 */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Returns how many days ago a date was (positive = past, negative = future).
 */
export function daysAgo(date: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((Date.now() - date.getTime()) / msPerDay);
}
