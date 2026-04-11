"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getOpenAI, OPENAI_IMAGE_MODEL } from "@/lib/openai/client";
import type { ContentVariant, VariantStatus } from "@/lib/supabase/types";

// =====================================================================
// Variant body / status actions
// =====================================================================

export async function updateVariantBody(
  variantId: string,
  body: string,
  metadata: Record<string, unknown> | null,
) {
  const { supabase, profile } = await requireUser();
  if (profile.role === "reviewer") {
    return { error: "Reviewer dürfen Inhalte nicht bearbeiten." };
  }

  const { data: variant } = await supabase
    .from("content_variants")
    .select("project_id")
    .eq("id", variantId)
    .single();

  const { error } = await supabase
    .from("content_variants")
    .update({ body, metadata })
    .eq("id", variantId);

  if (error) return { error: error.message };
  if (variant) revalidatePath(`/projects/${variant.project_id}`);
  return { ok: true };
}

export async function setVariantStatus(
  variantId: string,
  status: VariantStatus,
) {
  const { supabase, user, profile } = await requireUser();

  if (status === "approved" && profile.role === "editor") {
    return { error: "Nur Reviewer/Admin können freigeben." };
  }
  if (status === "published" && profile.role === "reviewer") {
    return { error: "Reviewer können nicht veröffentlichen." };
  }

  const { data: variant } = await supabase
    .from("content_variants")
    .select("project_id")
    .eq("id", variantId)
    .single();

  const update: Partial<ContentVariant> = { status };
  if (status === "approved") {
    update.reviewed_by = user.id;
    update.reviewed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("content_variants")
    .update(update)
    .eq("id", variantId);

  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: `variant_status_${status}`,
    target_type: "content_variant",
    target_id: variantId,
  });

  if (variant) revalidatePath(`/projects/${variant.project_id}`);
  return { ok: true };
}

// =====================================================================
// Blog image actions (gpt-image-1)
// =====================================================================

const BRAND_STYLE_SUFFIX =
  "Professionelle redaktionelle Bildsprache, hell und modern, medizinisches Umfeld (Augenarztpraxis), klar und ruhig komponiert, keine Textüberlagerung, fotografisch, 3:2 Querformat.";

type ImageSize = "1024x1024" | "1536x1024";

interface GenerateImageResult {
  imageId?: string;
  signedUrl?: string;
  error?: string;
}

export async function generateBlogImage(
  projectId: string,
  userPrompt: string,
  size: ImageSize = "1536x1024",
): Promise<GenerateImageResult> {
  const { supabase, user, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor können Bilder erzeugen." };
  }
  if (!userPrompt.trim()) return { error: "Prompt fehlt." };

  const finalPrompt = `${userPrompt.trim()}\n\nStil: ${BRAND_STYLE_SUFFIX}`;

  let imageBase64: string | null = null;
  try {
    const openai = getOpenAI();
    // gpt-image-1 returns base64 by default (no response_format param needed)
    const resp = await openai.images.generate({
      model: OPENAI_IMAGE_MODEL,
      prompt: finalPrompt,
      size,
      n: 1,
    });
    const first = resp.data?.[0];
    if (!first) return { error: "OpenAI hat kein Bild zurückgegeben." };
    if ("b64_json" in first && typeof first.b64_json === "string") {
      imageBase64 = first.b64_json;
    } else if ("url" in first && typeof first.url === "string") {
      // Some API versions return URL instead of base64 — download it.
      const res = await fetch(first.url);
      const buf = Buffer.from(await res.arrayBuffer());
      imageBase64 = buf.toString("base64");
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generateBlogImage] OpenAI error", msg);
    if (/safety|content_policy/i.test(msg)) {
      return {
        error:
          "Der Prompt wurde von OpenAI abgelehnt (Content-Policy). Formuliere ihn neutraler.",
      };
    }
    return { error: `Bildgenerierung fehlgeschlagen: ${msg}` };
  }

  if (!imageBase64) return { error: "Kein Bild-Payload empfangen." };

  const buffer = Buffer.from(imageBase64, "base64");
  const filename = `${projectId}/${crypto.randomUUID()}.png`;

  const { error: uploadErr } = await supabase.storage
    .from("generated-images")
    .upload(filename, buffer, {
      contentType: "image/png",
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadErr) {
    console.error("[generateBlogImage] upload error", uploadErr);
    return { error: `Storage-Upload fehlgeschlagen: ${uploadErr.message}` };
  }

  const { data: imageRow, error: insertErr } = await supabase
    .from("images")
    .insert({
      project_id: projectId,
      prompt: finalPrompt,
      storage_path: filename,
      size,
      is_featured: false,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr || !imageRow) {
    console.error("[generateBlogImage] insert error", insertErr);
    // Rollback storage
    await supabase.storage.from("generated-images").remove([filename]);
    return { error: "Bild-Metadaten konnten nicht gespeichert werden." };
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "generated_image",
    target_type: "image",
    target_id: imageRow.id,
    payload: { project_id: projectId, prompt: userPrompt, size },
  });

  const { data: signed } = await supabase.storage
    .from("generated-images")
    .createSignedUrl(filename, 3600);

  revalidatePath(`/projects/${projectId}`);

  return {
    imageId: imageRow.id,
    signedUrl: signed?.signedUrl,
  };
}

export async function setFeaturedImage(projectId: string, imageId: string) {
  const { supabase, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor." };
  }
  // Unmark all, then mark the selected one
  await supabase
    .from("images")
    .update({ is_featured: false })
    .eq("project_id", projectId);
  const { error } = await supabase
    .from("images")
    .update({ is_featured: true })
    .eq("id", imageId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteImage(imageId: string) {
  const { supabase, profile } = await requireUser();
  if (profile.role !== "admin") return { error: "Nur Admin." };

  const { data: img } = await supabase
    .from("images")
    .select("storage_path, project_id")
    .eq("id", imageId)
    .single();
  if (!img) return { error: "Bild nicht gefunden." };

  await supabase.storage.from("generated-images").remove([img.storage_path]);
  const { error } = await supabase.from("images").delete().eq("id", imageId);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${img.project_id}`);
  return { ok: true };
}

export async function getSignedImageUrl(storagePath: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase.storage
    .from("generated-images")
    .createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}
