"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ALL_CHANNELS, CHANNEL_LABELS, type Channel } from "@/lib/supabase/types";
import { addFeed } from "./actions";

export function AddFeedForm() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [channel, setChannel] = useState<Channel>("linkedin");
  const [pending, start] = useTransition();
  const toast = useToast();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData();
    form.set("name", name);
    form.set("url", url);
    form.set("channel", channel);
    start(async () => {
      const res = await addFeed(form);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
      } else {
        toast.show("Feed hinzugefügt.", "success");
        setName("");
        setUrl("");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-[1fr_2fr_160px_auto] md:items-end">
      <div className="space-y-2">
        <Label htmlFor="feed-name">Name</Label>
        <Input
          id="feed-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="z.B. LinkedIn Nadine"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="feed-url">Feed-URL</Label>
        <Input
          id="feed-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          placeholder="https://rss.app/feeds/..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="feed-channel">Kanal</Label>
        <select
          id="feed-channel"
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
          <Plus className="h-4 w-4" />
        )}
        Hinzufügen
      </Button>
    </form>
  );
}
