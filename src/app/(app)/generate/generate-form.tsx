"use client";

import { useTransition, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Lightbulb, Sparkles, Loader2 } from "lucide-react";
import { ChannelPicker } from "./channel-picker";
import { ALL_CHANNELS, type Channel } from "@/lib/supabase/types";
import { generateContent } from "./actions";
import { useToast } from "@/components/ui/toast";

/**
 * The Generate form accepts optional query-params to pre-fill itself
 * when a user clicks "In Projekt umwandeln" on an idea:
 *
 *   /generate?from_idea=<uuid>&topic=...&brief=...&channels=linkedin,blog
 *
 * The `from_idea` id is passed through to the server action so the
 * resulting project's id can be written back to the idea row.
 */
export function GenerateForm() {
  const search = useSearchParams();
  const initialTopic = search.get("topic") ?? "";
  const initialBrief = search.get("brief") ?? "";
  const fromIdea = search.get("from_idea");
  const initialChannels = (() => {
    const raw = search.get("channels");
    if (!raw) return ALL_CHANNELS;
    const parsed = raw
      .split(",")
      .map((c) => c.trim())
      .filter((c): c is Channel =>
        (ALL_CHANNELS as string[]).includes(c),
      );
    return parsed.length > 0 ? parsed : ALL_CHANNELS;
  })();

  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [topic, setTopic] = useState(initialTopic);
  const [brief, setBrief] = useState(initialBrief);
  const toast = useToast();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (channels.length === 0) {
      setError("Wähle mindestens einen Kanal aus.");
      return;
    }
    const form = new FormData();
    form.set("topic", topic);
    form.set("brief", brief);
    if (fromIdea) form.set("from_idea", fromIdea);
    for (const c of channels) form.append("channels", c);
    start(async () => {
      const res = await generateContent(form);
      if (res && "error" in res && res.error) {
        setError(res.error);
        toast.show(res.error, "error");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {fromIdea && (
        <div className="flex items-center gap-2 rounded-md border border-knowon-pink/30 bg-knowon-pink/5 px-3 py-2 text-sm">
          <Lightbulb className="h-4 w-4 text-knowon-pink" />
          <span>
            Du machst aus einer Idee ein Projekt. Daten sind vorausgefüllt —
            du kannst sie noch anpassen.
          </span>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <Label className="text-base">Kanäle</Label>
          <p className="text-sm text-muted-foreground">
            Wähle aus, welche Varianten erzeugt werden sollen. Alle sind
            standardmäßig aktiv.
          </p>
        </div>
        <ChannelPicker value={channels} onChange={setChannels} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="topic" className="text-base">
          Thema*
        </Label>
        <Input
          id="topic"
          name="topic"
          required
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="z.B. Neuer eLearning-Kurs: Glaukom-Diagnostik für MFAs"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="brief" className="text-base">
          Briefing (Stichpunkte, Fakten, Kernbotschaft)
        </Label>
        <Textarea
          id="brief"
          name="brief"
          rows={6}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={
            "- Kernbotschaft: Was ist das Wichtigste in einem Satz?\n- Zielgruppe: z.B. Augenärzte, MFAs, Orthoptisten\n- Fakten & Zahlen: z.B. 4 Module, 3 Std, zertifiziert\n- Referent oder Partner: Name + Rolle (falls relevant)\n- CTA: z.B. kostenlose Probelektion, Anmeldung, Kontakt"
          }
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {pending
            ? `Generiere ${channels.length} Kanäle…`
            : `Content für ${channels.length} ${
                channels.length === 1 ? "Kanal" : "Kanäle"
              } erzeugen`}
        </Button>
        {pending && (
          <p className="text-xs text-muted-foreground">
            Das dauert ~20–40 Sekunden. Bleib hier.
          </p>
        )}
      </div>
    </form>
  );
}
