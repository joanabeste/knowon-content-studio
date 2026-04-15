"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { PostChipPresentation } from "./components/post-chip";
import { CalendarDays, ChevronLeft, ChevronRight, List, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type {
  CalendarEntry,
  PersonOption,
  ProjectOption,
} from "./page";
import { reschedulePost } from "./actions";
import { FilterBar, type Filters } from "./components/filter-bar";
import { MonthGrid } from "./components/month-grid";
import { WeekGrid } from "./components/week-grid";
import { DateList } from "./components/date-list";
import {
  dayKey,
  formatMonthYear,
  startOfWeekMonday,
  addDays,
} from "./shared";

type View = "month" | "week" | "list";

function isValidView(v: string | undefined): v is View {
  return v === "month" || v === "week" || v === "list";
}

export function CalendarClient({
  entries: serverEntries,
  projects,
  people,
  canEdit,
  anchorIso,
  initialView,
  initialFilters,
}: {
  entries: CalendarEntry[];
  projects: ProjectOption[];
  people: PersonOption[];
  canEdit: boolean;
  anchorIso: string;
  initialView: string | undefined;
  initialFilters: Filters;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [view, setView] = useState<View>(
    isValidView(initialView) ? initialView : "month",
  );
  const [filters, setFilters] = useState<Filters>(initialFilters);

  // Optimistic overrides: when the user drags a post to a new day we
  // update `scheduled_at` locally so the chip jumps instantly, then
  // reconcile with whatever the server returns. Server revalidation
  // refreshes the server-side entries automatically via router.
  const [overrides, setOverrides] = useState<
    Record<string, { scheduled_at: string }>
  >({});

  // The entry the user is currently holding — drives the DragOverlay
  // floating preview so it's visually obvious what's in their hand.
  const [activeEntry, setActiveEntry] = useState<CalendarEntry | null>(null);

  const entries = useMemo(() => {
    return serverEntries.map((e) => {
      const o = overrides[e.id];
      if (!o) return e;
      return {
        ...e,
        scheduled_at: o.scheduled_at,
        anchor_date: o.scheduled_at,
      };
    });
  }, [serverEntries, overrides]);

  const anchor = useMemo(() => new Date(anchorIso), [anchorIso]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filters.status.length && !filters.status.includes(e.status))
        return false;
      if (filters.channel.length && !filters.channel.includes(e.channel))
        return false;
      if (filters.project && e.project_id !== filters.project) return false;
      if (
        filters.owner &&
        e.author_id !== filters.owner &&
        e.reviewer_id !== filters.owner
      )
        return false;
      return true;
    });
  }, [entries, filters]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of filtered) {
      const k = dayKey(e.anchor_date);
      const list = map.get(k) ?? [];
      list.push(e);
      map.set(k, list);
    }
    // Stable intra-day sort by scheduled time (nulls last).
    for (const list of map.values()) {
      list.sort((a, b) => {
        const ta = new Date(a.anchor_date).getTime();
        const tb = new Date(b.anchor_date).getTime();
        return ta - tb;
      });
    }
    return map;
  }, [filtered]);

  const sortedList = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          new Date(a.anchor_date).getTime() -
          new Date(b.anchor_date).getTime(),
      ),
    [filtered],
  );

  // Navigate: shift anchor date by one month (month view) or week.
  const shift = (delta: number) => {
    const next = new Date(anchor);
    if (view === "week") {
      next.setDate(next.getDate() + 7 * delta);
    } else {
      next.setMonth(next.getMonth() + delta);
    }
    const params = new URLSearchParams();
    params.set("d", dayKey(next));
    if (view !== "month") params.set("view", view);
    pushFilters(params);
    router.push(`/calendar?${params.toString()}`);
  };

  const goToday = () => {
    const params = new URLSearchParams();
    if (view !== "month") params.set("view", view);
    pushFilters(params);
    router.push(`/calendar${params.toString() ? `?${params}` : ""}`);
  };

  const changeView = (next: View) => {
    setView(next);
    const params = new URLSearchParams();
    params.set("d", dayKey(anchor));
    if (next !== "month") params.set("view", next);
    pushFilters(params);
    router.replace(`/calendar?${params.toString()}`);
  };

  const pushFilters = (params: URLSearchParams) => {
    if (filters.status.length)
      params.set("status", filters.status.join(","));
    if (filters.channel.length)
      params.set("channel", filters.channel.join(","));
    if (filters.project) params.set("project", filters.project);
    if (filters.owner) params.set("owner", filters.owner);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  );

  const onDragStart = (e: DragStartEvent) => {
    const entry = (e.active.data.current as { entry?: CalendarEntry } | undefined)
      ?.entry;
    if (entry) setActiveEntry(entry);
  };

  const onDragCancel = () => {
    setActiveEntry(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveEntry(null);
    if (!canEdit) return;
    const { active, over } = e;
    if (!over) return;
    const dateIso = (over.data.current as { dateIso?: string } | undefined)
      ?.dateIso;
    if (!dateIso) return;

    const variantId = String(active.id);
    const current = entries.find((en) => en.id === variantId);
    if (!current) return;

    // Preserve the original time-of-day if already scheduled.
    const target = new Date(dateIso);
    if (current.scheduled_at) {
      const prev = new Date(current.scheduled_at);
      target.setHours(
        prev.getHours(),
        prev.getMinutes(),
        prev.getSeconds(),
        0,
      );
    } else {
      target.setHours(9, 0, 0, 0);
    }
    const nextIso = target.toISOString();

    // No-op if dropping on the same day.
    if (dayKey(current.anchor_date) === dayKey(nextIso)) return;

    // Optimistic update.
    setOverrides((prev) => ({
      ...prev,
      [variantId]: { scheduled_at: nextIso },
    }));

    startTransition(async () => {
      const res = await reschedulePost(variantId, dateIso);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[variantId];
          return next;
        });
        return;
      }
      toast.show("Post umgeplant.", "success");
      router.refresh();
    });
  };

  const headerLabel = (() => {
    if (view === "week") {
      const start = startOfWeekMonday(anchor);
      const end = addDays(start, 6);
      return `${start.getDate()}.–${end.getDate()}. ${formatMonthYear(end)}`;
    }
    if (view === "list") return "Chronologisch";
    return formatMonthYear(anchor);
  })();

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {view !== "list" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => shift(-1)}
                  aria-label="Zurück"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => shift(1)}
                  aria-label="Vor"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={goToday}>
                  Heute
                </Button>
              </>
            )}
            <h2 className="ml-1 text-lg font-semibold">{headerLabel}</h2>
          </div>

          <div className="inline-flex rounded-lg border bg-card p-0.5">
            {(
              [
                { v: "month", label: "Monat", icon: CalendarDays },
                { v: "week", label: "Woche", icon: Rows3 },
                { v: "list", label: "Liste", icon: List },
              ] as const
            ).map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => changeView(v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                  view === v
                    ? "bg-knowon-teal text-white"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <FilterBar
          filters={filters}
          setFilters={setFilters}
          projects={projects}
          people={people}
        />

        {!canEdit && (
          <p className="rounded border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Nur Admin/Editor können Posts umplanen.
          </p>
        )}

        {view === "month" && (
          <MonthGrid
            anchor={anchor}
            entriesByDay={entriesByDay}
            canEdit={canEdit}
          />
        )}
        {view === "week" && (
          <WeekGrid
            anchor={anchor}
            entriesByDay={entriesByDay}
            canEdit={canEdit}
          />
        )}
        {view === "list" && <DateList entries={sortedList} />}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeEntry ? (
          <div className="pointer-events-none w-60 max-w-[60vw] cursor-grabbing">
            <PostChipPresentation entry={activeEntry} lifted />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
