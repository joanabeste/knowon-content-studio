import type { Channel, VariantStatus } from "@/lib/supabase/types";

export const STATUS_LABELS: Record<VariantStatus, string> = {
  draft: "Entwurf",
  in_review: "In Review",
  approved: "Freigegeben",
  published: "Veröffentlicht",
};

export const STATUS_COLORS: Record<VariantStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  in_review: "bg-amber-500 text-white",
  approved: "bg-knowon-teal text-white",
  published: "bg-knowon-purple text-white",
};

export const STATUS_BORDERS: Record<VariantStatus, string> = {
  draft: "border-l-muted-foreground/40",
  in_review: "border-l-amber-500",
  approved: "border-l-knowon-teal",
  published: "border-l-knowon-purple",
};

export const STATUS_ORDER: VariantStatus[] = [
  "draft",
  "in_review",
  "approved",
  "published",
];

export const CHANNEL_ICONS: Record<Channel, string> = {
  linkedin: "in",
  instagram: "ig",
  iprendo_news: "ip",
  eyefox: "ey",
  newsletter: "@",
  blog: "wp",
};

/** Key a date as YYYY-MM-DD in local time (matters for calendars). */
export function dayKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfWeekMonday(d: Date): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  const dow = next.getDay();
  const diff = (dow + 6) % 7; // Mon=0, Sun=6
  next.setDate(next.getDate() - diff);
  return next;
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatMonthYear(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatDayHeader(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

export const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
