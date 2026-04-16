"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Send, User2, X } from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";
import { CHANNEL_LABELS } from "@/lib/supabase/types";
import type { CalendarEntry } from "../page";
import {
  CHANNEL_ICONS,
  STATUS_BORDERS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "../shared";

/**
 * Quick-preview overlay shown when a user clicks a post chip in the
 * calendar. Instead of jumping straight to the project, we surface
 * the key facts (project, channel, status, schedule, people) plus
 * a direct "Zum Editor"-Link.
 */
export function PostPreview({
  entry,
  onClose,
}: {
  entry: CalendarEntry;
  onClose: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const Icon = CHANNEL_ICONS[entry.channel];
  const scheduled = entry.scheduled_at ?? entry.published_at;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Vorschau schließen"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-label="Post-Vorschau"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border-l-4 bg-card shadow-2xl",
          STATUS_BORDERS[entry.status],
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                STATUS_COLORS[entry.status],
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {CHANNEL_LABELS[entry.channel]}
              </div>
              <div className="truncate text-sm font-semibold">
                {entry.project_topic}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-2.5 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                STATUS_COLORS[entry.status],
              )}
            >
              {STATUS_LABELS[entry.status]}
            </span>
            <span className="text-xs text-muted-foreground">
              v{entry.version}
            </span>
          </div>

          {scheduled && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              <span>
                {entry.published_at ? "Veröffentlicht" : "Geplant"}{" "}
                {formatRelative(scheduled)}
              </span>
            </div>
          )}

          {(entry.author_name || entry.reviewer_name) && (
            <div className="space-y-1 text-xs text-muted-foreground">
              {entry.author_name && (
                <div className="flex items-center gap-2">
                  <User2 className="h-3.5 w-3.5" />
                  <span>
                    <span className="text-foreground/80">Ersteller</span>:{" "}
                    {entry.author_name}
                  </span>
                </div>
              )}
              {entry.reviewer_name && (
                <div className="flex items-center gap-2">
                  <User2 className="h-3.5 w-3.5" />
                  <span>
                    <span className="text-foreground/80">Reviewer</span>:{" "}
                    {entry.reviewer_name}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t bg-muted/20 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Schließen
          </button>
          <Link
            href={`/projects/${entry.project_id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-knowon-teal px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-knowon-teal/90"
          >
            <Send className="h-3.5 w-3.5" />
            Zum Editor
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </footer>
      </div>
    </>
  );
}
