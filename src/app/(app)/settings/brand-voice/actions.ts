"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";

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
