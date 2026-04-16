"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { CHANNEL_LABELS } from "@/lib/supabase/types";
import type { CalendarEntry } from "../page";
import {
  CHANNEL_ICONS,
  STATUS_BORDERS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "../shared";

/**
 * Pure visual chip — no DnD hooks, no link. Used by both the
 * in-grid draggable `PostChip` and by the DragOverlay in
 * calendar-client.tsx so the dragged preview looks identical to
 * the source. Split out so the overlay never registers as a
 * second draggable with the same id.
 */
export function PostChipPresentation({
  entry,
  compact = false,
  ghost = false,
  lifted = false,
  className,
}: {
  entry: CalendarEntry;
  compact?: boolean;
  /** In-grid placeholder while dragging. */
  ghost?: boolean;
  /** The floating overlay copy while the user holds it. */
  lifted?: boolean;
  className?: string;
}) {
  const Icon = CHANNEL_ICONS[entry.channel];
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded border-l-2 bg-card px-1.5 py-1 text-xs ring-1 ring-border/60 transition",
        STATUS_BORDERS[entry.status],
        !ghost && !lifted && "shadow-sm hover:ring-knowon-teal/50",
        ghost &&
          "border-dashed opacity-30 shadow-none ring-0 [border-left-style:dashed]",
        lifted &&
          "-rotate-2 scale-[1.03] shadow-2xl ring-2 ring-knowon-teal/40",
        compact && "truncate",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm",
          STATUS_COLORS[entry.status],
        )}
        title={`${CHANNEL_LABELS[entry.channel]} · ${STATUS_LABELS[entry.status]}`}
        aria-label={CHANNEL_LABELS[entry.channel]}
      >
        <Icon className="h-2.5 w-2.5" />
      </span>
      <span className="min-w-0 flex-1 truncate">{entry.project_topic}</span>
    </div>
  );
}

/**
 * A single post pill rendered inside a calendar cell. Draggable
 * for editors/admins (the DnD context above disables the sensor
 * entirely for reviewers, so we don't need to branch here).
 *
 * Click behaviour:
 * - If `onClick` is provided (default in the calendar), it opens the
 *   quick-preview dialog instead of navigating straight to the project.
 * - Otherwise falls back to a Link → /projects/[id] (used in date-list
 *   and other static contexts).
 */
export function PostChip({
  entry,
  compact = false,
  draggable = true,
  onClick,
}: {
  entry: CalendarEntry;
  compact?: boolean;
  draggable?: boolean;
  onClick?: (entry: CalendarEntry) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entry.id,
    data: { entry },
    disabled: !draggable,
  });

  const presentation = (
    <PostChipPresentation entry={entry} compact={compact} ghost={isDragging} />
  );

  // Preview-mode: button instead of link so clicking opens the quick
  // preview. Drag is disabled when not draggable (reviewers).
  if (onClick) {
    const handleClick = (e: React.MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        return;
      }
      onClick(entry);
    };

    if (draggable) {
      return (
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          className={cn(
            "touch-none cursor-grab active:cursor-grabbing",
            isDragging && "cursor-grabbing",
          )}
        >
          <button
            type="button"
            onClick={handleClick}
            className="block w-full text-left"
          >
            {presentation}
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={handleClick}
        className="block w-full text-left"
      >
        {presentation}
      </button>
    );
  }

  // Legacy link mode — kept for DateList and any non-calendar caller.
  if (draggable) {
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={cn(
          "touch-none cursor-grab active:cursor-grabbing",
          isDragging && "cursor-grabbing",
        )}
      >
        <Link
          href={`/projects/${entry.project_id}`}
          onClick={(e) => {
            if (isDragging) e.preventDefault();
          }}
          className="block"
        >
          {presentation}
        </Link>
      </div>
    );
  }

  return (
    <Link href={`/projects/${entry.project_id}`} className="block">
      {presentation}
    </Link>
  );
}
