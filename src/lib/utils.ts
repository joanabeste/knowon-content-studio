import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * Relative German time: "vor 2 Min.", "vor 3 Std.", "vor 5 Tagen",
 * then switches to absolute date for anything older than ~14 days.
 */
export function formatRelative(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  if (diffSec < 60) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  if (diffHr < 24) return `vor ${diffHr} Std.`;
  if (diffDay < 14)
    return diffDay === 1 ? "vor 1 Tag" : `vor ${diffDay} Tagen`;
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date);
}
