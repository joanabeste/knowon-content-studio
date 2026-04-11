"use client";

import { useState, useTransition } from "react";
import { Calendar, ExternalLink, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { publishBlogToWordpress } from "./actions";

type PublishMode = "draft" | "future" | "publish";

/**
 * Formats a Date into the value string that `<input type="datetime-local">`
 * expects (`YYYY-MM-DDTHH:mm`), in the user's local timezone.
 */
function toLocalInput(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` +
    `T${pad(value.getHours())}:${pad(value.getMinutes())}`
  );
}

function minScheduleNow(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5); // +5 min buffer
  return toLocalInput(d);
}

export function WpPublishForm({
  projectId,
  variantId,
}: {
  projectId: string;
  variantId: string;
}) {
  const [mode, setMode] = useState<PublishMode>("draft");
  const [dateLocal, setDateLocal] = useState<string>(minScheduleNow());
  const [pending, start] = useTransition();
  const toast = useToast();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let dateIso: string | null = null;
    if (mode === "future") {
      if (!dateLocal) {
        toast.show("Bitte ein Datum und eine Uhrzeit wählen.", "error");
        return;
      }
      // datetime-local is in user's local TZ → convert to ISO (UTC)
      const parsed = new Date(dateLocal);
      if (Number.isNaN(parsed.getTime())) {
        toast.show("Ungültiges Datum.", "error");
        return;
      }
      if (parsed.getTime() <= Date.now()) {
        toast.show("Datum muss in der Zukunft liegen.", "error");
        return;
      }
      dateIso = parsed.toISOString();
    }

    start(async () => {
      const res = await publishBlogToWordpress(projectId, variantId, {
        status: mode,
        dateIso,
      });
      if (res && "error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      if (res && "wpPostUrl" in res && res.wpPostUrl) {
        const base =
          mode === "publish"
            ? "Live veröffentlicht"
            : mode === "future"
              ? "Geplant in WordPress"
              : "Als Entwurf angelegt";
        const hasImage =
          "wpFeaturedMediaId" in res && res.wpFeaturedMediaId != null;
        const suffix = hasImage
          ? " · Beitragsbild ✓"
          : " · ohne Beitragsbild";
        toast.show(base + suffix, hasImage ? "success" : "info");
        window.open(res.wpPostUrl, "_blank");
      }
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-md border bg-muted/30 p-3"
    >
      <div className="text-xs font-semibold uppercase text-muted-foreground">
        WordPress-Publish
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="space-y-1">
          <Label htmlFor="wp-mode" className="text-xs">
            Modus
          </Label>
          <select
            id="wp-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as PublishMode)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="draft">Entwurf (manuell in WP publizieren)</option>
            <option value="future">Geplant (automatisch zum Datum)</option>
            <option value="publish">Sofort live</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="wp-date" className="text-xs">
            Datum / Uhrzeit
            {mode === "future" && " *"}
          </Label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="wp-date"
              type="datetime-local"
              value={dateLocal}
              onChange={(e) => setDateLocal(e.target.value)}
              min={minScheduleNow()}
              disabled={mode !== "future"}
              className="pl-9"
            />
          </div>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : mode === "publish" ? (
            <ExternalLink className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {mode === "publish"
            ? "Sofort live"
            : mode === "future"
              ? "Planen"
              : "Als Entwurf"}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Das Post wird mit Titel, Slug, Meta-Description, Tags und Featured
        Image an WordPress übergeben. Bei „Geplant" veröffentlicht WP
        automatisch zum angegebenen Zeitpunkt.
      </p>
    </form>
  );
}
