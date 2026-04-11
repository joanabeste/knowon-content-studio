"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";
import { ChannelPicker } from "./channel-picker";
import { ALL_CHANNELS, type Channel } from "@/lib/supabase/types";
import { generateContent } from "./actions";
import { useToast } from "@/components/ui/toast";

export function GenerateForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>(ALL_CHANNELS);
  const [topic, setTopic] = useState("");
  const [brief, setBrief] = useState("");
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
            "- Zielgruppe: MFAs in Augenarztpraxen\n- Kursstart: 15. Mai\n- USP: 100% online, Zertifikat, Expertin Dr. XY\n- CTA: Anmeldung über knowon.de/kontakt"
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
