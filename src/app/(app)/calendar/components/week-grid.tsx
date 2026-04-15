"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { CalendarEntry } from "../page";
import {
  addDays,
  dayKey,
  formatDayHeader,
  sameDay,
  startOfWeekMonday,
} from "../shared";
import { PostChip } from "./post-chip";

function WeekColumn({
  date,
  entries,
  isToday,
  canEdit,
}: {
  date: Date;
  entries: CalendarEntry[];
  isToday: boolean;
  canEdit: boolean;
}) {
  const key = dayKey(date);
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${key}`,
    data: { dateIso: date.toISOString(), dateKey: key },
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[60vh] flex-col gap-2 border-r p-2 transition last:border-r-0",
        isOver && "bg-knowon-teal/10",
      )}
    >
      <div
        className={cn(
          "sticky top-0 rounded bg-card/80 px-1 py-0.5 text-xs font-semibold backdrop-blur",
          isToday && "text-knowon-pink",
        )}
      >
        {formatDayHeader(date)}
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.length === 0 ? (
          <p className="text-[10px] italic text-muted-foreground">—</p>
        ) : (
          entries.map((e) => (
            <PostChip key={e.id} entry={e} draggable={canEdit} />
          ))
        )}
      </div>
    </div>
  );
}

export function WeekGrid({
  anchor,
  entriesByDay,
  canEdit,
}: {
  anchor: Date;
  entriesByDay: Map<string, CalendarEntry[]>;
  canEdit: boolean;
}) {
  const start = startOfWeekMonday(anchor);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="grid grid-cols-7">
        {days.map((d) => (
          <WeekColumn
            key={d.toISOString()}
            date={d}
            entries={entriesByDay.get(dayKey(d)) ?? []}
            isToday={sameDay(d, today)}
            canEdit={canEdit}
          />
        ))}
      </div>
    </div>
  );
}
