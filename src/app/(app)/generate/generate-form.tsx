"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { generateContent } from "./actions";

export function GenerateForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    start(async () => {
      const res = await generateContent(form);
      if (res && "error" in res && res.error) setError(res.error);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="topic">Thema*</Label>
        <Input
          id="topic"
          name="topic"
          required
          placeholder="z.B. Neuer Online-Kurs zu Kontaktlinsen-Anpassung"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="brief">Briefing (Stichpunkte, Fakten, Kernbotschaft)</Label>
        <Textarea
          id="brief"
          name="brief"
          rows={6}
          placeholder={
            "- Zielgruppe: Augenoptiker*innen mit 2+ Jahren Erfahrung\n- Kursstart: 15. Mai\n- USP: 100% online, Zertifikat, Expertin Dr. XY\n- CTA: Anmeldung über knowon.de/kontakt"
          }
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={pending}>
        <Sparkles className="h-4 w-4" />
        {pending ? "Generiere für alle Kanäle…" : "Content erzeugen"}
      </Button>
      {pending && (
        <p className="text-xs text-muted-foreground">
          Das dauert je nach Modell ~20-40 Sekunden. Bleib hier.
        </p>
      )}
    </form>
  );
}
