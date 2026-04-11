"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOpenAI, OPENAI_IMAGE_MODEL } from "@/lib/openai/client";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadWpCredentials } from "@/lib/wordpress/credentials";
import { uploadMedia, createPost } from "@/lib/wordpress/client";
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

// =====================================================================
// WordPress publish (blog variant → WP draft post with featured image)
// =====================================================================

export interface PublishOptions {
  /**
   * "draft"   = Entwurf (manuell in WP veröffentlichen)
   * "future"  = Geplant, WP veröffentlicht automatisch zum Datum
   * "publish" = Sofort live
   */
  status?: "draft" | "future" | "publish";
  /**
   * ISO-String (z.B. `2026-05-15T10:00:00.000Z`).
   * Bei status=future verpflichtend und muss in der Zukunft liegen.
   */
  dateIso?: string | null;
}

export async function publishBlogToWordpress(
  projectId: string,
  variantId: string,
  options: PublishOptions = {},
) {
  const { supabase, user, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor können publizieren." };
  }

  const status = options.status ?? "draft";
  const dateIso = options.dateIso ?? null;

  // Validation: if status=future, date must be in the future
  if (status === "future") {
    if (!dateIso) {
      return { error: "Für geplante Veröffentlichung ist ein Datum erforderlich." };
    }
    const parsed = Date.parse(dateIso);
    if (Number.isNaN(parsed)) {
      return { error: "Ungültiges Datumsformat." };
    }
    if (parsed <= Date.now()) {
      return { error: "Geplantes Datum muss in der Zukunft liegen." };
    }
  }

  const creds = await loadWpCredentials();
  if (!creds) {
    return {
      error:
        "WordPress-Zugangsdaten fehlen. Trage sie in Settings → Integrationen ein.",
    };
  }

  // Fetch blog variant
  const { data: variant } = await supabase
    .from("content_variants")
    .select("*")
    .eq("id", variantId)
    .single();
  if (!variant || variant.channel !== "blog") {
    return { error: "Blog-Variante nicht gefunden." };
  }
  if (variant.status !== "approved") {
    return {
      error: "Nur freigegebene Varianten können publiziert werden.",
    };
  }

  const metadata = (variant.metadata ?? {}) as Record<string, unknown>;
  const title = (metadata.title as string) || "Ohne Titel";
  const slug = (metadata.slug as string) || undefined;
  const excerpt = (metadata.excerpt as string) || undefined;
  const metaDescription = (metadata.meta_description as string) || undefined;
  const tagNames = (metadata.suggested_tags as string[] | undefined) ?? [];
  const content = variant.body;

  // Fetch featured image if exists
  let featuredMediaId: number | undefined;
  const { data: featured } = await supabase
    .from("images")
    .select("storage_path")
    .eq("project_id", projectId)
    .eq("is_featured", true)
    .maybeSingle();

  if (featured?.storage_path) {
    // Download from Supabase storage
    const admin = getSupabaseAdmin();
    const { data: fileData, error: dlErr } = await admin.storage
      .from("generated-images")
      .download(featured.storage_path);
    if (dlErr) {
      return {
        error: `Featured image download fehlgeschlagen: ${dlErr.message}`,
      };
    }
    const arr = await fileData.arrayBuffer();
    const buffer = Buffer.from(arr);
    try {
      const uploaded = await uploadMedia(
        creds,
        `${slug || "blog-image"}.png`,
        buffer,
        "image/png",
      );
      featuredMediaId = uploaded.id;

      // Also store wp_media_id on the image row for future use
      await supabase
        .from("images")
        .update({ wp_media_id: uploaded.id })
        .eq("storage_path", featured.storage_path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: `WP Bild-Upload fehlgeschlagen: ${msg}` };
    }
  }

  // Create post in WordPress
  let post;
  try {
    post = await createPost(creds, {
      title,
      content,
      excerpt,
      slug,
      featuredMediaId,
      tagNames,
      metaDescription,
      status,
      date: dateIso ?? undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `WP Post create fehlgeschlagen: ${msg}` };
  }

  // Mark variant as published locally. We consider it "published" from
  // our side as soon as WordPress has accepted the post — even if the
  // actual publication is scheduled for the future. WP will take it live.
  await supabase
    .from("content_variants")
    .update({
      status: "published",
      metadata: {
        ...metadata,
        wp_post_id: post.id,
        wp_post_url: post.link,
        wp_status: status,
        wp_scheduled_for: dateIso ?? null,
      },
    })
    .eq("id", variantId);

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "published_to_wp",
    target_type: "content_variant",
    target_id: variantId,
    payload: {
      wp_post_id: post.id,
      wp_post_url: post.link,
      wp_status: status,
      wp_scheduled_for: dateIso ?? null,
      featured_media_id: featuredMediaId ?? null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return {
    ok: true,
    wpPostId: post.id,
    wpPostUrl: post.link,
    wpStatus: status,
    wpScheduledFor: dateIso,
  };
}

// =====================================================================
// Project delete
// =====================================================================

export async function deleteProject(projectId: string) {
  const { supabase, user, profile } = await requireUser();

  // Fetch project to check ownership
  const { data: project } = await supabase
    .from("content_projects")
    .select("id, created_by, topic")
    .eq("id", projectId)
    .single();

  if (!project) return { error: "Projekt nicht gefunden." };

  const isOwner = project.created_by === user.id;
  if (profile.role !== "admin" && !isOwner) {
    return { error: "Nur Admin oder Ersteller*in darf löschen." };
  }

  // Collect image paths to remove from storage
  const { data: imgs } = await supabase
    .from("images")
    .select("storage_path")
    .eq("project_id", projectId);
  const paths = (imgs ?? []).map((i) => i.storage_path).filter(Boolean);

  if (paths.length) {
    await supabase.storage.from("generated-images").remove(paths);
  }

  // Cascades: variants and images via FK
  const { error } = await supabase
    .from("content_projects")
    .delete()
    .eq("id", projectId);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "project_deleted",
    target_type: "content_project",
    target_id: projectId,
    payload: { topic: project.topic },
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect("/projects");
}
