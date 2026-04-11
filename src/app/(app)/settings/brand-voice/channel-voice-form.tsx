"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { Channel, ChannelBrandVoice } from "@/lib/supabase/types";
import { saveChannelBrandVoice } from "./actions";

export function ChannelVoiceForm({
  channel,
  initial,
}: {
  channel: Channel;
  initial: ChannelBrandVoice | null;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveChannelBrandVoice(channel, form);
      if ("error" in res && res.error) toast.show(res.error, "error");
      else toast.show("Gespeichert.", "success");
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Leere Felder fallen auf die allgemeine Brand Voice zurück. Du kannst
        einzelne Felder pro Kanal überschreiben, ohne das globale Profil zu
        ändern.
      </p>

      <div className="space-y-2">
        <Label htmlFor="tone">Ton (kanal-spezifisch)</Label>
        <Textarea
          id="tone"
          name="tone"
          rows={3}
          defaultValue={initial?.tone ?? ""}
          placeholder="z.B. Professionell-persönlich, Hook in den ersten 2 Zeilen..."
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="length_guideline">Längen-/Format-Regel</Label>
          <Input
            id="length_guideline"
            name="length_guideline"
            defaultValue={initial?.length_guideline ?? ""}
            placeholder="z.B. 600-1500 Zeichen, 3-5 Hashtags"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cta_style">CTA-Stil</Label>
          <Input
            id="cta_style"
            name="cta_style"
            defaultValue={initial?.cta_style ?? ""}
            placeholder="z.B. Subtil, am Ende, Link in Bio"
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="specific_dos">
            Zusätzliche Do&apos;s (eine Zeile pro Eintrag)
          </Label>
          <Textarea
            id="specific_dos"
            name="specific_dos"
            rows={6}
            defaultValue={initial?.specific_dos?.join("\n") ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="specific_donts">
            Zusätzliche Don&apos;ts (eine Zeile pro Eintrag)
          </Label>
          <Textarea
            id="specific_donts"
            name="specific_donts"
            rows={6}
            defaultValue={initial?.specific_donts?.join("\n") ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Weitere Notizen</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={initial?.notes ?? ""}
          placeholder="Alles, was dem Modell sonst noch helfen soll..."
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Speichern
      </Button>
    </form>
  );
}
