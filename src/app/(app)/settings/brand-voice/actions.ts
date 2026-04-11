"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
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

// =====================================================================
// Brand logo upload — stored in `generated-images/brand/...`, path
// referenced from brand_voice.logo_path. The file is pulled into
// every generated/uploaded blog image's overlay at composite time,
// so uploading a new one instantly changes the watermark on future
// images without touching existing ones.
// =====================================================================

const ALLOWED_LOGO_MIME = new Set([
  "image/png",
  "image/svg+xml",
  "image/webp",
  "image/jpeg",
]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB — more than enough for a logo

export async function uploadBrandLogo(
  formData: FormData,
): Promise<{ ok: true; path: string } | { error: string }> {
  const { supabase, user } = await requireRole("admin");

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Keine Datei übergeben." };
  if (!ALLOWED_LOGO_MIME.has(file.type)) {
    return { error: "Nur PNG, SVG, WebP oder JPG werden unterstützt." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return {
      error: `Datei zu groß (${Math.round(file.size / 1024)} KB, max 2 MB).`,
    };
  }

  const ext =
    file.type === "image/svg+xml"
      ? "svg"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/jpeg"
          ? "jpg"
          : "png";

  // Content-addressable path via random id so browsers don't serve a
  // stale cached version when the logo changes.
  const path = `brand/logo-${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // Use the admin client so we're not subject to the bucket's RLS
  // (which scopes uploads to project folders, not brand/).
  const admin = getSupabaseAdmin();
  const { error: uploadErr } = await admin.storage
    .from("generated-images")
    .upload(path, buffer, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
  if (uploadErr) return { error: `Upload fehlgeschlagen: ${uploadErr.message}` };

  // Fetch old path to clean up afterwards
  const { data: existing } = await supabase
    .from("brand_voice")
    .select("logo_path")
    .eq("id", 1)
    .single();

  const { error: updateErr } = await supabase
    .from("brand_voice")
    .update({
      logo_path: path,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", 1);
  if (updateErr) {
    // Roll back the upload so we don't orphan the file
    await admin.storage.from("generated-images").remove([path]);
    return { error: updateErr.message };
  }

  // Best-effort: delete the old logo file (don't fail the request if this errors)
  const oldPath = (existing as { logo_path: string | null } | null)?.logo_path;
  if (oldPath && oldPath !== path) {
    await admin.storage.from("generated-images").remove([oldPath]);
  }

  revalidatePath("/settings/brand-voice");
  return { ok: true, path };
}

export async function removeBrandLogo(): Promise<
  { ok: true } | { error: string }
> {
  const { supabase, user } = await requireRole("admin");

  const { data: existing } = await supabase
    .from("brand_voice")
    .select("logo_path")
    .eq("id", 1)
    .single();
  const path = (existing as { logo_path: string | null } | null)?.logo_path;

  const { error } = await supabase
    .from("brand_voice")
    .update({
      logo_path: null,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", 1);
  if (error) return { error: error.message };

  if (path) {
    const admin = getSupabaseAdmin();
    await admin.storage.from("generated-images").remove([path]);
  }

  revalidatePath("/settings/brand-voice");
  return { ok: true };
}

export async function getBrandLogoSignedUrl(): Promise<{ url: string | null }> {
  const { supabase } = await requireRole("admin");
  const { data } = await supabase
    .from("brand_voice")
    .select("logo_path")
    .eq("id", 1)
    .single();
  const path = (data as { logo_path: string | null } | null)?.logo_path;
  if (!path) return { url: null };

  const admin = getSupabaseAdmin();
  const { data: signed } = await admin.storage
    .from("generated-images")
    .createSignedUrl(path, 3600);
  return { url: signed?.signedUrl ?? null };
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
