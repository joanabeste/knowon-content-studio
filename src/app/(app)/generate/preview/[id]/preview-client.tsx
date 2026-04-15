"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  CHANNEL_LABELS,
  type ContentProject,
  type ContentVariant,
} from "@/lib/supabase/types";
import {
  acceptPreview,
  discardPreview,
  regeneratePreview,
} from "./actions";

export function PreviewClient({
  project,
  variants,
}: {
  project: ContentProject;
  variants: ContentVariant[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [showRegen, setShowRegen] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");

  const onAccept = () => {
    start(async () => {
      const res = await acceptPreview(project.id);
      if (res && "error" in res && res.error) {
        toast.show(res.error, "error");
      }
    });
  };

  const onDiscard = () => {
    if (
      !confirm(
        "Preview wirklich verwerfen? Alle generierten Texte gehen verloren.",
      )
    ) {
      return;
    }
    start(async () => {
      const res = await discardPreview(project.id);
      if (res && "error" in res && res.error) {
        toast.show(res.error, "error");
      }
    });
  };

  const onRegenerate = () => {
    start(async () => {
      const res = await regeneratePreview(project.id, extraPrompt || null);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("Neu generiert.", "success");
      setShowRegen(false);
      setExtraPrompt("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <div className="flex-1 text-sm">
          <p className="font-semibold">
            Sieht der Basis-Content gut aus?
          </p>
          <p className="text-xs text-muted-foreground">
            Übernehmen erstellt das Projekt, verwerfen löscht alles,
            neu generieren überschreibt die aktuellen Texte.
          </p>
        </div>
        <Button onClick={onAccept} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Übernehmen
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowRegen((v) => !v)}
          disabled={pending}
        >
          <RefreshCw className="h-4 w-4" />
          Alle neu generieren
        </Button>
        <Button variant="outline" onClick={onDiscard} disabled={pending}>
          <Trash2 className="h-4 w-4" />
          Verwerfen
        </Button>
      </div>

      {showRegen && (
        <div className="space-y-3 rounded-lg border border-dashed bg-muted/20 p-4">
          <div className="space-y-1.5">
            <Label>Zusätzliche Anweisung (optional)</Label>
            <Textarea
              rows={3}
              value={extraPrompt}
              onChange={(e) => setExtraPrompt(e.target.value)}
              placeholder={'z.B. „ohne Datum", „weniger Emojis", „kürzer fassen"…'}
            />
            <p className="text-xs text-muted-foreground">
              Die Anweisung wird beim neuen Generieren zusätzlich an das
              Modell geschickt. Leer lassen für einfaches neu generieren.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onRegenerate} disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Jetzt neu generieren
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowRegen(false);
                setExtraPrompt("");
              }}
              disabled={pending}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {variants.map((v) => (
          <Card key={v.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {CHANNEL_LABELS[v.channel]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderMetadataSummary(v)}
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">
                {v.body}
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function renderMetadataSummary(v: ContentVariant) {
  const m = v.metadata ?? {};
  const items: Array<[string, string]> = [];
  if (typeof m.title === "string") items.push(["Titel", m.title]);
  if (typeof m.subject === "string") items.push(["Betreff", m.subject]);
  if (typeof m.preheader === "string")
    items.push(["Preheader", m.preheader]);
  if (typeof m.meta_description === "string")
    items.push(["Meta", m.meta_description]);
  if (items.length === 0) return null;
  return (
    <dl className="space-y-1 text-xs text-muted-foreground">
      {items.map(([k, val]) => (
        <div key={k} className="flex gap-2">
          <dt className="font-semibold">{k}:</dt>
          <dd className="truncate">{val}</dd>
        </div>
      ))}
    </dl>
  );
}
