import { requireRole } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChannelVoiceTabs } from "./channel-voice-tabs";
import type {
  BrandVoice,
  Channel,
  ChannelBrandVoice,
} from "@/lib/supabase/types";

export default async function BrandVoicePage() {
  const { supabase } = await requireRole("admin");

  const [{ data: general }, { data: channelRows }] = await Promise.all([
    supabase.from("brand_voice").select("*").eq("id", 1).single(),
    supabase.from("channel_brand_voice").select("*"),
  ]);

  const channelVoices: Partial<Record<Channel, ChannelBrandVoice>> = {};
  for (const cv of (channelRows ?? []) as ChannelBrandVoice[]) {
    channelVoices[cv.channel] = cv;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Brand Voice</h1>
        <p className="text-muted-foreground">
          Allgemeine KnowOn-Stimme und kanal-spezifische Feinjustierungen.
          Alles fließt automatisch in jede Generierung ein.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Stilprofil</CardTitle>
          <CardDescription>
            Der „Allgemein"-Tab gilt für alle Kanäle. Die Kanal-Tabs
            überschreiben oder ergänzen einzelne Aspekte nur für diesen Kanal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChannelVoiceTabs
            generalVoice={general as BrandVoice | null}
            channelVoices={channelVoices}
          />
        </CardContent>
      </Card>
    </div>
  );
}
