"use client";

import * as React from "react";
import {
  Linkedin,
  Instagram,
  Mail,
  FileText,
  Newspaper,
  Megaphone,
  Check,
} from "lucide-react";
import { ALL_CHANNELS, CHANNEL_LABELS, type Channel } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const CHANNEL_META: Record<
  Channel,
  { icon: React.ComponentType<{ className?: string }>; description: string }
> = {
  linkedin: { icon: Linkedin, description: "B2B-Post, Hook + Hashtags" },
  instagram: { icon: Instagram, description: "Caption + Hashtags" },
  iprendo_news: {
    icon: Megaphone,
    description: "News-Beitrag im Instagram-Caption-Stil",
  },
  eyefox: { icon: Newspaper, description: "Partnerseiten-Text, sachlich" },
  newsletter: { icon: Mail, description: "Betreff + HTML-Body" },
  blog: { icon: FileText, description: "SEO-Artikel mit Beitragsbild" },
};

export function ChannelPicker({
  value,
  onChange,
}: {
  value: Channel[];
  onChange: (next: Channel[]) => void;
}) {
  const toggle = (ch: Channel) => {
    if (value.includes(ch)) {
      onChange(value.filter((c) => c !== ch));
    } else {
      onChange([...value, ch]);
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ALL_CHANNELS.map((ch) => {
        const checked = value.includes(ch);
        const Icon = CHANNEL_META[ch].icon;
        return (
          <button
            type="button"
            key={ch}
            onClick={() => toggle(ch)}
            className={cn(
              "flex items-start gap-3 rounded-lg border bg-card p-4 text-left transition-all",
              "hover:border-primary/60 hover:shadow-sm",
              checked
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                checked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background",
              )}
            >
              {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
            </span>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Icon className="h-4 w-4" />
                {CHANNEL_LABELS[ch]}
              </div>
              <p className="text-xs text-muted-foreground">
                {CHANNEL_META[ch].description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
