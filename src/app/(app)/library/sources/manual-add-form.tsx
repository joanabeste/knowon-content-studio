"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Loader2, Plus } from "lucide-react";
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  type Channel,
} from "@/lib/supabase/types";
import { addSourcePostManual } from "./actions";

export function ManualAddForm() {
  const [channel, setChannel] = useState<Channel>("linkedin");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      toast.show("Inhalt fehlt.", "error");
      return;
    }
    const form = new FormData();
    form.set("channel", channel);
    form.set("title", title);
    form.set("body", body);
    form.set("url", url);
    if (isFeatured) form.set("is_featured", "on");

    start(async () => {
      const res = await addSourcePostManual(form);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("Eintrag gespeichert.", "success");
      setTitle("");
      setBody("");
      setUrl("");
      setIsFeatured(false);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[160px_1fr]">
        <div className="space-y-2">
          <Label htmlFor="manual-channel">Kanal</Label>
          <select
            id="manual-channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {ALL_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {CHANNEL_LABELS[ch]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-title">Titel (optional)</Label>
          <Input
            id="manual-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Kurzer Titel oder Thema"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-body">Inhalt*</Label>
        <Textarea
          id="manual-body"
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          placeholder="Den vollständigen Post-Text einfügen. Wird GPT als Stil-Referenz übergeben."
        />
        <p className="text-xs text-muted-foreground">
          {body.length.toLocaleString("de-DE")} Zeichen
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="manual-url">Quell-URL (optional)</Label>
          <Input
            id="manual-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Als Featured markieren
        </label>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Eintrag hinzufügen
      </Button>
    </form>
  );
}
