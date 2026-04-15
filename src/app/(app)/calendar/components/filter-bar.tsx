"use client";

import { X } from "lucide-react";
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
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Status
        </span>
        {STATUS_ORDER.map((s: VariantStatus) => {
          const active = filters.status.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle("status", s)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium transition",
                active
                  ? STATUS_COLORS[s]
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Kanal
        </span>
        {ALL_CHANNELS.map((c: Channel) => {
          const active = filters.channel.includes(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggle("channel", c)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium transition",
                active
                  ? "bg-knowon-teal text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {CHANNEL_LABELS[c]}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">
            Projekt
          </span>
          <select
            value={filters.project ?? ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                project: e.target.value || null,
              })
            }
            className="rounded border bg-background px-2 py-1"
          >
            <option value="">Alle</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.topic}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">
            Person
          </span>
          <select
            value={filters.owner ?? ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                owner: e.target.value || null,
              })
            }
            className="rounded border bg-background px-2 py-1"
          >
            <option value="">Alle</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/70"
          >
            <X className="h-3 w-3" />
            {activeCount} Filter zurücksetzen
          </button>
        )}
      </div>
    </div>
  );
}
