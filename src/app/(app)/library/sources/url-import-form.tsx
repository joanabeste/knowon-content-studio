"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Loader2, Download } from "lucide-react";
import { ALL_CHANNELS, CHANNEL_LABELS, type Channel } from "@/lib/supabase/types";
import { importFromUrl } from "./actions";

export function UrlImportForm() {
  const [url, setUrl] = useState("");
  const [channel, setChannel] = useState<Channel>("linkedin");
  const [pending, start] = useTransition();
  const toast = useToast();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData();
    form.set("url", url);
    form.set("channel", channel);
    start(async () => {
      const res = await importFromUrl(form);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
      } else {
        toast.show("URL importiert.", "success");
        setUrl("");
      }
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 md:grid-cols-[1fr_160px_auto] md:items-end"
    >
      <div className="space-y-2">
        <Label htmlFor="url-import-url">Public URL</Label>
        <Input
          id="url-import-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          placeholder="https://www.linkedin.com/posts/... oder beliebige öffentliche Seite"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="url-import-channel">Kanal</Label>
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
      <Button type="submit" disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Importieren
      </Button>
    </form>
  );
}
