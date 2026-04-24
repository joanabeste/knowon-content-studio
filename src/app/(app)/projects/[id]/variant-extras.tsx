"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn, formatRelative } from "@/lib/utils";
import type {
  ContentVariantWithPeople,
  VariantVersion,
  VariantVersionReason,
} from "@/lib/supabase/types";
import {
  applyNoteToVariant,
  listVariantVersions,
  regenerateVariant,
  restoreVariantVersion,
} from "./actions";

// --------------------------------------------------------------------
// Regenerate this one channel with optional extra prompt
// --------------------------------------------------------------------
export function RegenerateVariantButton({
  variantId,
  disabled,
}: {
  variantId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");

  const submit = () => {
    start(async () => {
      const res = await regenerateVariant(variantId, {
        extraPrompt: extraPrompt || null,
      });
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("Neu generiert. Alte Version archiviert.", "success");
      setOpen(false);
      setExtraPrompt("");
      router.refresh();
    });
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <RefreshCw className="h-4 w-4" />
        Neu generieren
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed bg-muted/20 p-3">
      <Label className="text-xs font-semibold uppercase tracking-wide">
        Nur diesen Kanal neu generieren
      </Label>
      <Textarea
        rows={2}
        value={extraPrompt}
        onChange={(e) => setExtraPrompt(e.target.value)}
        placeholder={'Zusätzliche Anweisung, z.B. „kürzer", „mit mehr Call-to-Action"…'}
        className="text-xs"
      />
      <p className="text-[11px] text-muted-foreground">
        Der aktuelle Text wird als neue Version archiviert — du kannst
        über die Historie zurück.
      </p>
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Abbrechen
        </Button>
        <Button size="sm" onClick={submit} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Jetzt neu generieren
        </Button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Version history — lazy-loaded dropdown with restore action
// --------------------------------------------------------------------

const REASON_LABEL: Record<VariantVersionReason, string> = {
  regenerate_channel: "Neu generiert",
  regenerate_all: "Komplett neu",
  apply_note: "Notiz eingearbeitet",
  manual_edit: "Manuell bearbeitet",
};

export function VersionHistory({
  variant,
  canRestore,
}: {
  variant: ContentVariantWithPeople;
  canRestore: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<VariantVersion[] | null>(null);
  const [pending, start] = useTransition();

  const loadVersions = async () => {
    setLoading(true);
    const res = await listVariantVersions(variant.id);
    setLoading(false);
    if ("error" in res) {
      toast.show(res.error ?? "Fehler beim Laden.", "error");
      return;
    }
    setVersions(res.versions as unknown as VariantVersion[]);
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && versions === null) loadVersions();
  };

  const restore = (versionId: string) => {
    if (
      !confirm(
        "Diese archivierte Version wiederherstellen? Der aktuelle Text wird als neue Version gespeichert.",
      )
    ) {
      return;
    }
    start(async () => {
      const res = await restoreVariantVersion(variant.id, versionId);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show(`v${res.version} ist jetzt aktuell.`, "success");
      setOpen(false);
      setVersions(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        <History className="h-3 w-3" />
        v{variant.version} {open ? "↑" : "↓"}
      </button>
      {open && (
        <div className="rounded-md border bg-background p-2 text-xs">
          {loading && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> lade Historie…
            </div>
          )}
          {!loading && versions && versions.length === 0 && (
            <p className="text-muted-foreground">Keine älteren Versionen.</p>
          )}
          {!loading && versions && versions.length > 0 && (
            <ul className="space-y-1.5">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">v{v.version}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {REASON_LABEL[v.reason]}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        · {formatRelative(v.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                      {v.body.slice(0, 120)}
                    </p>
                  </div>
                  {canRestore && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => restore(v.id)}
                      disabled={pending}
                      className={cn("shrink-0 text-xs")}
                    >
                      <RotateCcw className="h-3 w-3" /> Wiederherstellen
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------
// Apply-note wand (integrates review note into body via GPT)
// --------------------------------------------------------------------

export function ApplyNoteButton({
  variantId,
  noteId,
  appliedToVersion,
  disabled,
}: {
  variantId: string;
  noteId: string;
  appliedToVersion: number | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  if (appliedToVersion !== null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-knowon-teal/10 px-2 py-0.5 text-[10px] font-semibold text-knowon-teal">
        ✓ eingearbeitet in v{appliedToVersion}
      </span>
    );
  }

  const run = () => {
    if (
      !confirm(
        "Notiz per KI in den Text einarbeiten? Der aktuelle Text wird archiviert.",
      )
    ) {
      return;
    }
    start(async () => {
      const res = await applyNoteToVariant(variantId, noteId);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show(`In v${res.version} eingearbeitet.`, "success");
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={disabled || pending}
      title="Notiz per KI in den Text einarbeiten"
      aria-label="Notiz einarbeiten"
      className="inline-flex items-center gap-1 rounded-md border border-knowon-pink/30 bg-knowon-pink/5 px-2 py-0.5 text-[11px] font-medium text-knowon-pink transition hover:bg-knowon-pink/10 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Wand2 className="h-3 w-3" />
      )}
      <span>Einarbeiten</span>
    </button>
  );
}
