"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveBrandVoice } from "./actions";
import type { BrandVoice } from "@/lib/supabase/types";

export function BrandVoiceForm({ initial }: { initial: BrandVoice | null }) {
  const [pending, start] = useTransition();
  const toast = useToast();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveBrandVoice(form);
      if ("error" in res && res.error) toast.show(res.error, "error");
      else toast.show("Gespeichert.", "success");
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="tone">Tonfall</Label>
        <Input
          id="tone"
          name="tone"
          defaultValue={initial?.tone ?? ""}
          placeholder="z.B. freundlich, kompetent, nahbar, inspirierend"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="audience">Zielgruppe</Label>
        <Textarea
          id="audience"
          name="audience"
          rows={3}
          defaultValue={initial?.audience ?? ""}
          placeholder="z.B. Augenoptiker*innen, die sich digital weiterbilden wollen…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="about_knowon">Über KnowOn (Kurzbeschreibung)</Label>
        <Textarea
          id="about_knowon"
          name="about_knowon"
          rows={3}
          defaultValue={initial?.about_knowon ?? ""}
          placeholder="KnowOn ist eine Online-Lernplattform für…"
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dos">Do&apos;s (ein Eintrag pro Zeile)</Label>
          <Textarea
            id="dos"
            name="dos"
            rows={6}
            defaultValue={initial?.dos?.join("\n") ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="donts">Don&apos;ts (ein Eintrag pro Zeile)</Label>
          <Textarea
            id="donts"
            name="donts"
            rows={6}
            defaultValue={initial?.donts?.join("\n") ?? ""}
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Speichern
        </Button>
      </div>
    </form>
  );
}
