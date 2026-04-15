"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  type Channel,
  type VariantStatus,
} from "@/lib/supabase/types";
import type { PersonOption, ProjectOption } from "../page";
import { STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from "../shared";

export type Filters = {
  status: string[];
  channel: string[];
  project: string | null;
  owner: string | null;
};

export function FilterBar({
  filters,
  setFilters,
  projects,
  people,
}: {
  filters: Filters;
  setFilters: (next: Filters) => void;
  projects: ProjectOption[];
  people: PersonOption[];
}) {
  const toggle = (field: "status" | "channel", value: string) => {
    const current = filters[field];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setFilters({ ...filters, [field]: next });
  };

  const activeCount =
    filters.status.length +
    filters.channel.length +
    (filters.project ? 1 : 0) +
    (filters.owner ? 1 : 0);

  const clear = () =>
    setFilters({ status: [], channel: [], project: null, owner: null });

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          Filter
          {activeCount > 0 && (
            <span className="rounded-full bg-knowon-teal/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-knowon-teal">
              {activeCount} aktiv
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <X className="h-3 w-3" />
            Alle zurücksetzen
          </button>
        )}
      </header>

      <div className="divide-y">
        <FilterRow label="Status">
          {STATUS_ORDER.map((s: VariantStatus) => {
            const active = filters.status.includes(s);
            return (
              <FilterPill
                key={s}
                active={active}
                onClick={() => toggle("status", s)}
                activeClassName={STATUS_COLORS[s]}
              >
                {STATUS_LABELS[s]}
              </FilterPill>
            );
          })}
        </FilterRow>

        <FilterRow label="Kanal">
          {ALL_CHANNELS.map((c: Channel) => {
            const active = filters.channel.includes(c);
            return (
              <FilterPill
                key={c}
                active={active}
                onClick={() => toggle("channel", c)}
                activeClassName="bg-knowon-teal text-white"
              >
                {CHANNEL_LABELS[c]}
              </FilterPill>
            );
          })}
        </FilterRow>

        <FilterRow label="Zuordnung">
          <select
            value={filters.project ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, project: e.target.value || null })
            }
            className={cn(
              "min-w-[10rem] max-w-full rounded-md border bg-background px-2 py-1 text-xs transition",
              filters.project && "border-knowon-teal ring-1 ring-knowon-teal/30",
            )}
            aria-label="Projekt filter"
          >
            <option value="">Alle Projekte</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.topic}
              </option>
            ))}
          </select>
          <select
            value={filters.owner ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, owner: e.target.value || null })
            }
            className={cn(
              "min-w-[10rem] max-w-full rounded-md border bg-background px-2 py-1 text-xs transition",
              filters.owner && "border-knowon-teal ring-1 ring-knowon-teal/30",
            )}
            aria-label="Person filter"
          >
            <option value="">Alle Personen</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </FilterRow>
      </div>
    </section>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:w-20 sm:shrink-0">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  activeClassName,
  children,
}: {
  active: boolean;
  onClick: () => void;
  activeClassName: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition",
        active
          ? cn(activeClassName, "border-transparent shadow-sm ring-1 ring-black/5")
          : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
