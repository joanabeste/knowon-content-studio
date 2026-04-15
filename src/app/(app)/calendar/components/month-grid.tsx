"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { CalendarEntry } from "../page";
import {
  WEEKDAY_SHORT,
  addDays,
  dayKey,
  sameDay,
  startOfWeekMonday,
} from "../shared";
import { PostChip } from "./post-chip";

function DayCell({
  date,
  entries,
  isOtherMonth,
  isToday,
  canEdit,
}: {
  date: Date;
  entries: CalendarEntry[];
  isOtherMonth: boolean;
  isToday: boolean;
  canEdit: boolean;
}) {
  const key = dayKey(date);
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${key}`,
    data: { dateIso: date.toISOString(), dateKey: key },
    disabled: !canEdit,
  });

  const visible = entries.slice(0, 3);
  const extra = entries.length - visible.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[110px] flex-col gap-1 border-b border-r p-1.5 transition",
        isOtherMonth && "bg-muted/30 text-muted-foreground",
        isOver && "bg-knowon-teal/10 ring-1 ring-knowon-teal",
      )}
    >
      <div
        className={cn(
          "text-xs font-semibold",
          isToday &&
            "inline-flex h-5 w-5 items-center justify-center self-start rounded-full bg-knowon-pink text-white",
        )}
      >
        {date.getDate()}
      </div>
      <div className="flex flex-col gap-1">
        {visible.map((e) => (
          <PostChip key={e.id} entry={e} compact draggable={canEdit} />
        ))}
        {extra > 0 && (
          <span className="text-[10px] text-muted-foreground">
            +{extra} weitere
          </span>
        )}
      </div>
    </div>
  );
}

export function MonthGrid({
  anchor,
  entriesByDay,
  canEdit,
}: {
  anchor: Date;
  entriesByDay: Map<string, CalendarEntry[]>;
  canEdit: boolean;
}) {
  const monthStart = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    1,
  );
  const gridStart = startOfWeekMonday(monthStart);
  const today = new Date();

  // 6 weeks × 7 days = 42 cells always, so the grid height is stable.
  const days: Date[] = Array.from({ length: 42 }, (_, i) =>
    addDays(gridStart, i),
  );

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAY_SHORT.map((w) => (
          <div
            key={w}
            className="border-r px-2 py-1.5 text-xs font-semibold text-muted-foreground last:border-r-0"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => (
          <DayCell
            key={d.toISOString()}
            date={d}
            entries={entriesByDay.get(dayKey(d)) ?? []}
            isOtherMonth={d.getMonth() !== anchor.getMonth()}
            isToday={sameDay(d, today)}
            canEdit={canEdit}
          />
        ))}
      </div>
    </div>
  );
}
