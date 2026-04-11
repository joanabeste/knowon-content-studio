"use client";

import * as React from "react";
import {
  Linkedin,
  Instagram,
  Mail,
  FileText,
  Newspaper,
  Plus,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  type Channel,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { addChannelsToProject } from "./actions";

const CHANNEL_ICONS: Record<
  Channel,
  React.ComponentType<{ className?: string }>
> = {
  linkedin: Linkedin,
  instagram: Instagram,
  eyefox: Newspaper,
  newsletter: Mail,
  blog: FileText,
};

export function AddChannelsSection({
  projectId,
  existingChannels,
}: {
  projectId: string;
  existingChannels: Channel[];
}) {
  const missing = ALL_CHANNELS.filter((c) => !existingChannels.includes(c));
  const [selected, setSelected] = React.useState<Channel[]>([]);
  const [pending, start] = React.useTransition();
  const toast = useToast();
  const router = useRouter();

  if (missing.length === 0) return null;

  const toggle = (ch: Channel) => {
    setSelected((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  };

  const onGenerate = () => {
    if (selected.length === 0) {
      toast.show("Mindestens einen Kanal wählen.", "error");
      return;
    }
    start(async () => {
      const res = await addChannelsToProject(projectId, selected);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show(
        `${selected.length} neue Kanal-Variante${
          selected.length === 1 ? "" : "n"
        } erzeugt.`,
        "success",
      );
      setSelected([]);
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-4">
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
        Kanäle hinzufügen
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Für die bisher nicht generierten Kanäle kannst du Varianten
        nachträglich erzeugen — sie nutzen dasselbe Thema und Briefing wie das
        ursprüngliche Projekt.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {missing.map((ch) => {
          const Icon = CHANNEL_ICONS[ch];
          const active = selected.includes(ch);
          return (
            <button
              key={ch}
              type="button"
              onClick={() => toggle(ch)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {active ? (
                <Check className="h-4 w-4" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              {CHANNEL_LABELS[ch]}
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        onClick={onGenerate}
        disabled={pending || selected.length === 0}
        size="sm"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        {pending
          ? "Generiere…"
          : selected.length === 0
            ? "Generieren"
            : `${selected.length} Kanal${
                selected.length === 1 ? "" : "äle"
              } generieren`}
      </Button>
    </div>
  );
}
