"use client";

import * as React from "react";
import {
  Linkedin,
  Instagram,
  Mail,
  FileText,
  Newspaper,
  Megaphone,
  Mic,
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
  type BrandVoice,
  type Channel,
  type ChannelBrandVoice,
} from "@/lib/supabase/types";
import { BrandVoiceForm } from "./brand-voice-form";
import { ChannelVoiceForm } from "./channel-voice-form";

const CHANNEL_ICONS: Record<
  Channel,
  React.ComponentType<{ className?: string }>
> = {
  linkedin: Linkedin,
  instagram: Instagram,
  iprendo_news: Megaphone,
  eyefox: Newspaper,
  newsletter: Mail,
  blog: FileText,
};

export function ChannelVoiceTabs({
  generalVoice,
  channelVoices,
}: {
  generalVoice: BrandVoice | null;
  channelVoices: Partial<Record<Channel, ChannelBrandVoice>>;
}) {
  return (
    <Tabs defaultValue="general">
      <TabsList className="w-full overflow-x-auto">
        <TabsTrigger value="general">
          <Mic className="h-4 w-4" />
          Allgemein
        </TabsTrigger>
        {ALL_CHANNELS.map((ch) => {
          const Icon = CHANNEL_ICONS[ch];
          return (
            <TabsTrigger key={ch} value={ch}>
              <Icon className="h-4 w-4" />
              {CHANNEL_LABELS[ch]}
            </TabsTrigger>
          );
        })}
      </TabsList>

      <TabsContent value="general">
        <BrandVoiceForm initial={generalVoice} />
      </TabsContent>

      {ALL_CHANNELS.map((ch) => (
        <TabsContent key={ch} value={ch}>
          <ChannelVoiceForm channel={ch} initial={channelVoices[ch] ?? null} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
