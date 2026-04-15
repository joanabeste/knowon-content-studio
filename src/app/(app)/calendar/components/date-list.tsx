"use client";

import type { CalendarEntry } from "../page";
import { dayKey } from "../shared";
import { PostChip } from "./post-chip";

function formatGroupHeader(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.getTime() === today.getTime()) return "Heute";
  if (d.getTime() === tomorrow.getTime()) return "Morgen";

  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function DateList({
  entries,
}: {
  entries: CalendarEntry[];
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Keine Posts für die aktuelle Auswahl.
      </div>
    );
  }

  // Group by day, already sorted chronologically by caller.
  const groups = new Map<string, CalendarEntry[]>();
  for (const e of entries) {
    const k = dayKey(e.anchor_date);
    const list = groups.get(k) ?? [];
    list.push(e);
    groups.set(k, list);
  }

  const sortedKeys = Array.from(groups.keys()).sort();

  return (
    <div className="space-y-5">
      {sortedKeys.map((k) => (
        <section key={k}>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            {formatGroupHeader(k)}
          </h3>
          <div className="flex flex-col gap-2">
            {(groups.get(k) ?? []).map((e) => (
              <PostChip key={e.id} entry={e} draggable={false} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
