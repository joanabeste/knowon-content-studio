"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import type { Channel } from "@/lib/supabase/types";

export async function saveBrandVoice(formData: FormData) {
  const { supabase, user } = await requireRole("admin");

  const tone = String(formData.get("tone") || "");
  const audience = String(formData.get("audience") || "");
  const about_knowon = String(formData.get("about_knowon") || "");
  const dos = String(formData.get("dos") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const donts = String(formData.get("donts") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const { error } = await supabase
    .from("brand_voice")
    .update({
      tone,
      audience,
      about_knowon,
      dos,
      donts,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", 1);

  if (error) return { error: error.message };

  revalidatePath("/settings/brand-voice");
  return { ok: true };
}

const VALID_CHANNELS: Channel[] = [
  "linkedin",
  "instagram",
  "eyefox",
  "newsletter",
  "blog",
];

export async function saveChannelBrandVoice(
  channel: Channel,
  formData: FormData,
) {
  const { supabase, user } = await requireRole("admin");

  if (!VALID_CHANNELS.includes(channel)) {
    return { error: "Ungültiger Kanal." };
  }

  const tone = (String(formData.get("tone") || "").trim() || null) as
    | string
    | null;
  const length_guideline =
    (String(formData.get("length_guideline") || "").trim() || null) as
      | string
      | null;
  const cta_style =
    (String(formData.get("cta_style") || "").trim() || null) as string | null;
  const notes =
    (String(formData.get("notes") || "").trim() || null) as string | null;
  const specific_dos = String(formData.get("specific_dos") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const specific_donts = String(formData.get("specific_donts") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const { error } = await supabase
    .from("channel_brand_voice")
    .update({
      tone,
      length_guideline,
      cta_style,
      specific_dos,
      specific_donts,
      notes,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("channel", channel);

  if (error) return { error: error.message };

  revalidatePath("/settings/brand-voice");
  return { ok: true };
}
