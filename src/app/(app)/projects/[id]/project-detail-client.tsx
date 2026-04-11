"use client";

import * as React from "react";
import {
  Linkedin,
  Instagram,
  Mail,
  FileText,
  Newspaper,
  Plus,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  type Channel,
  type ContentVariant,
  type UserRole,
} from "@/lib/supabase/types";
import { VariantCard } from "./variant-card";
import { BlogImagePanel, type ImageWithUrl } from "./blog-image-panel";
import { AddChannelsSection } from "./add-channels-section";

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

const ADD_TAB = "__add__";

export function ProjectDetailClient({
  projectId,
  channels,
  variants,
  images,
  role,
}: {
  projectId: string;
  channels: Channel[];
  variants: ContentVariant[];
  images: ImageWithUrl[];
  role: UserRole;
}) {
  // Variant map by channel for quick lookup
  const variantByChannel = React.useMemo(() => {
    const m = new Map<Channel, ContentVariant>();
    for (const v of variants) m.set(v.channel, v);
    return m;
  }, [variants]);

  const canAddChannels = role === "admin" || role === "editor";
  const missingChannels = ALL_CHANNELS.filter((c) => !channels.includes(c));
  const showAddTab = canAddChannels && missingChannels.length > 0;

  const defaultTab = channels[0] ?? (showAddTab ? ADD_TAB : "blog");

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="w-full overflow-x-auto">
        {channels.map((ch) => {
          const Icon = CHANNEL_ICONS[ch];
          const variant = variantByChannel.get(ch);
          return (
            <TabsTrigger key={ch} value={ch}>
              <Icon className="h-4 w-4" />
              {CHANNEL_LABELS[ch]}
              {variant && variant.status !== "draft" && (
                <span
                  className={
                    variant.status === "in_review"
                      ? "ml-1 h-1.5 w-1.5 rounded-full bg-amber-500"
                      : variant.status === "approved"
                        ? "ml-1 h-1.5 w-1.5 rounded-full bg-knowon-teal"
                        : "ml-1 h-1.5 w-1.5 rounded-full bg-foreground/60"
                  }
                />
              )}
            </TabsTrigger>
          );
        })}
        {showAddTab && (
          <TabsTrigger
            value={ADD_TAB}
            className="border border-dashed border-muted-foreground/40 text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            <Plus className="h-4 w-4" />
            Kanal hinzufügen
          </TabsTrigger>
        )}
      </TabsList>

      {channels.map((ch) => {
        const variant = variantByChannel.get(ch);
        if (!variant)
          return (
            <TabsContent key={ch} value={ch}>
              <p className="text-sm text-muted-foreground">
                Noch keine Variante erzeugt.
              </p>
            </TabsContent>
          );
        return (
          <TabsContent key={ch} value={ch} className="space-y-4">
            {ch === "blog" && (
              <BlogImagePanel
                projectId={projectId}
                blogTitle={(variant.metadata?.title as string) ?? null}
                initialImages={images}
                role={role}
              />
            )}
            <VariantCard
              variant={variant}
              channelLabel={CHANNEL_LABELS[ch]}
              role={role}
            />
          </TabsContent>
        );
      })}

      {showAddTab && (
        <TabsContent value={ADD_TAB}>
          <AddChannelsSection
            projectId={projectId}
            existingChannels={channels}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
