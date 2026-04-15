"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { CHANNEL_LABELS } from "@/lib/supabase/types";
import type { CalendarEntry } from "../page";
import {
  STATUS_BORDERS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "../shared";

/**
 * A single post pill rendered inside a calendar cell. Draggable
 * for editors/admins (the DnD context above disables the sensor
 * entirely for reviewers, so we don't need to branch here). Click
 * navigates to the project detail.
 */
export function PostChip({
  entry,
  compact = false,
  draggable = true,
}: {
  entry: CalendarEntry;
  compact?: boolean;
  draggable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entry.id,
    data: { entry },
    disabled: !draggable,
  });

  const content = (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded border-l-2 bg-card px-1.5 py-1 text-xs shadow-sm ring-1 ring-border/60 transition hover:ring-knowon-teal/50",
        STATUS_BORDERS[entry.status],
        isDragging && "opacity-40",
        compact && "truncate",
      )}
    >
      <span
        className={cn(
          "shrink-0 rounded-sm px-1 py-[1px] text-[9px] font-semibold uppercase tracking-wide",
          STATUS_COLORS[entry.status],
        )}
        title={STATUS_LABELS[entry.status]}
      >
        {CHANNEL_LABELS[entry.channel].slice(0, 3)}
      </span>
      <span className="min-w-0 flex-1 truncate">{entry.project_topic}</span>
    </div>
  );

  if (draggable) {
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className="touch-none"
      >
        <Link
          href={`/projects/${entry.project_id}`}
          onClick={(e) => {
            // If the user actually dragged, dnd-kit sets pointer
            // capture and React fires click only on a static press.
            // We don't need to block anything manually.
            if (isDragging) e.preventDefault();
          }}
          className="block"
        >
          {content}
        </Link>
      </div>
    );
  }

  return (
    <Link href={`/projects/${entry.project_id}`} className="block">
      {content}
    </Link>
  );
}
