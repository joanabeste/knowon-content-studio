"use client";

import { useState, useTransition } from "react";
import { CalendarClock, X as XIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { formatRelative } from "@/lib/utils";
import type { ContentVariantWithPeople } from "@/lib/supabase/types";
import { setVariantSchedule } from "./actions";

/**
 * Inline scheduler: compact datetime-local input next to a "geplant
 * am" label. For editors/admins, saves on blur/change. For reviewers,
 * renders read-only text instead.
 */
export function SchedulePicker({
  variant,
  canEdit,
}: {
  variant: ContentVariantWithPeople;
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const [value, setValue] = useState<string>(() =>
    toLocalInputValue(variant.scheduled_at),
  );

  const save = (next: string) => {
    start(async () => {
      const res = await setVariantSchedule(variant.id, next || null);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show(next ? "Termin gespeichert." : "Termin entfernt.", "success");
    });
  };

  if (!canEdit) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" />
        <span>
          {variant.scheduled_at
            ? `Geplant: ${formatRelative(variant.scheduled_at)}`
            : "Kein Termin geplant"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs">
      <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
      <Label className="text-xs text-muted-foreground">Geplant für</Label>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value !== toLocalInputValue(variant.scheduled_at)) {
            save(value);
          }
        }}
        disabled={pending}
        className="rounded border bg-background px-2 py-0.5 text-xs"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            save("");
          }}
          disabled={pending}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
          aria-label="Termin löschen"
          title="Termin entfernen"
        >
          <XIcon className="h-3 w-3" />
          Termin entfernen
        </button>
      )}
    </div>
  );
}

/**
 * Turn an ISO timestamp into the local-timezone format expected by
 * <input type="datetime-local">: `YYYY-MM-DDTHH:mm`. Returns an empty
 * string for null / invalid input so the input renders as empty.
 */
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
