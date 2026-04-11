"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Loader2, Download } from "lucide-react";
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  type Channel,
} from "@/lib/supabase/types";
import { importFromUrls } from "./actions";

export function UrlImportForm() {
  const [urls, setUrls] = useState("");
  const [channel, setChannel] = useState<Channel>("linkedin");
  const [pending, start] = useTransition();
  const toast = useToast();

  const urlCount = urls
    .split(/\s+/)
    .filter((u) => /^https?:\/\//.test(u.trim())).length;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData();
    form.set("urls", urls);
    form.set("channel", channel);
    start(async () => {
      const res = await importFromUrls(form);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      if ("total" in res) {
        if (res.failCount === 0) {
          toast.show(`${res.okCount} von ${res.total} importiert`, "success");
          setUrls("");
        } else {
          toast.show(
            `${res.okCount} ok, ${res.failCount} fehlgeschlagen`,
            "error",
          );
        }
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="url-import-urls">Public URLs (eine pro Zeile)</Label>
          <span className="text-xs text-muted-foreground">
            {urlCount} URL{urlCount === 1 ? "" : "s"} erkannt
          </span>
        </div>
        <Textarea
          id="url-import-urls"
          rows={6}
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          required
          placeholder={
            "https://www.linkedin.com/posts/...\nhttps://www.instagram.com/p/...\nhttps://www.knowon.de/fachwissen/..."
          }
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Max. 50 URLs pro Batch. Jede URL wird einzeln geholt, Titel + Body
          via og:title/og:description/Text extrahiert.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="url-import-channel">Kanal (für alle)</Label>
          <select
            id="url-import-channel"
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
        <Button type="submit" disabled={pending || urlCount === 0}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {pending ? "Importiere…" : `${urlCount} URL${urlCount === 1 ? "" : "s"} importieren`}
        </Button>
      </div>
    </form>
  );
}
