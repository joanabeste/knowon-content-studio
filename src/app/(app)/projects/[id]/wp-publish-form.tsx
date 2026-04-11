"use client";

import { useState, useTransition } from "react";
import {
  Calendar,
  ExternalLink,
  Loader2,
  Send,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { publishBlogToWordpress } from "./actions";

type PublishMode = "draft" | "future" | "publish";

function toLocalInput(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` +
    `T${pad(value.getHours())}:${pad(value.getMinutes())}`
  );
}

function minScheduleNow(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5);
  return toLocalInput(d);
}

export function WpPublishForm({
  projectId,
  variantId,
  isUpdate = false,
  wpPostUrl = null,
}: {
  projectId: string;
  variantId: string;
  isUpdate?: boolean;
  wpPostUrl?: string | null;
}) {
  const [mode, setMode] = useState<PublishMode>("draft");
  const [dateLocal, setDateLocal] = useState<string>(minScheduleNow());
  const [pending, start] = useTransition();
  const toast = useToast();

  const headline = isUpdate
    ? "Änderungen nach WordPress senden"
    : "Nach WordPress senden";

  const submitLabel = isUpdate
    ? mode === "publish"
      ? "Jetzt aktualisieren"
      : mode === "future"
        ? "Neu planen"
        : "Entwurf aktualisieren"
    : mode === "publish"
      ? "Sofort live"
      : mode === "future"
        ? "Planen"
        : "Als Entwurf";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let dateIso: string | null = null;
    if (mode === "future") {
      if (!dateLocal) {
        toast.show("Bitte ein Datum und eine Uhrzeit wählen.", "error");
        return;
      }
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
        const baseLabel = isUpdate
          ? mode === "publish"
            ? "In WordPress aktualisiert & live"
            : mode === "future"
              ? "Neu geplant in WordPress"
              : "WordPress-Entwurf aktualisiert"
          : mode === "publish"
            ? "Live veröffentlicht"
            : mode === "future"
              ? "Geplant in WordPress"
              : "Als Entwurf angelegt";
        const hasImage =
          "wpFeaturedMediaId" in res && res.wpFeaturedMediaId != null;
        const suffix = hasImage
          ? " · Beitragsbild ✓"
          : " · ohne Beitragsbild";
        toast.show(baseLabel + suffix, hasImage ? "success" : "info");
        window.open(res.wpPostUrl, "_blank");
      }
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-md border bg-muted/30 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          {headline}
        </div>
        {isUpdate && wpPostUrl && (
          <a
            href={wpPostUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Aktuellen Post ansehen
          </a>
        )}
      </div>

      {isUpdate && (
        <p className="text-xs text-muted-foreground">
          Dieser Beitrag existiert bereits in WordPress. Änderungen werden in
          den bestehenden Post übernommen, es wird kein neuer angelegt.
        </p>
      )}

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
          ) : isUpdate ? (
            <RefreshCw className="h-4 w-4" />
          ) : mode === "publish" ? (
            <ExternalLink className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {submitLabel}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {isUpdate
          ? "Titel, Slug, Meta-Description, Tags und Beitragsbild werden im bestehenden WP-Post aktualisiert."
          : "Titel, Slug, Meta-Description, Tags und Beitragsbild werden an WordPress übergeben."}
        {mode === "future" &&
          " Im Modus Geplant veröffentlicht WP automatisch zum angegebenen Zeitpunkt."}
      </p>
    </form>
  );
}
