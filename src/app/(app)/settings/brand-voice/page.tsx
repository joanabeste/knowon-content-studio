import { requireRole } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BrandVoiceForm } from "./brand-voice-form";
import type { BrandVoice } from "@/lib/supabase/types";

export default async function BrandVoicePage() {
  const { supabase } = await requireRole("admin");
  const { data } = await supabase
    .from("brand_voice")
    .select("*")
    .eq("id", 1)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Brand Voice</h1>
        <p className="text-muted-foreground">
          Diese Einstellungen fließen automatisch in jede Generierung ein.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Stilprofil</CardTitle>
          <CardDescription>
            Tonfall, Zielgruppe und Do&apos;s/Don&apos;ts für konsistenten Content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrandVoiceForm initial={data as BrandVoice | null} />
        </CardContent>
      </Card>
    </div>
  );
}
