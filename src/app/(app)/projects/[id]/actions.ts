"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOpenAI, OPENAI_IMAGE_MODEL } from "@/lib/openai/client";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadWpCredentials } from "@/lib/wordpress/credentials";
import { uploadMedia, createPost, updatePost } from "@/lib/wordpress/client";
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

/**
 * Upload a user-provided image file (PNG/JPG/WebP). Alternative to
 * generateBlogImage — same output (row in images table, file in
 * Supabase storage).
 */
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

export async function uploadBlogImage(
  projectId: string,
  formData: FormData,
): Promise<GenerateImageResult> {
  const { supabase, user, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor können Bilder hochladen." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Keine Datei übergeben." };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: "Nur PNG, JPG oder WebP werden unterstützt." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: `Datei zu groß (${Math.round(file.size / 1024 / 1024)} MB, max 8 MB).`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const filename = `${projectId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("generated-images")
    .upload(filename, buffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadErr) {
    return { error: `Upload fehlgeschlagen: ${uploadErr.message}` };
  }

  const { data: imageRow, error: insertErr } = await supabase
    .from("images")
    .insert({
      project_id: projectId,
      prompt: `Upload: ${file.name}`,
      storage_path: filename,
      size: null,
      is_featured: false,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr || !imageRow) {
    await supabase.storage.from("generated-images").remove([filename]);
    return { error: "Bild-Metadaten konnten nicht gespeichert werden." };
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "uploaded_image",
    target_type: "image",
    target_id: imageRow.id,
    payload: { project_id: projectId, filename: file.name, size: file.size },
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
  // Allow both 'approved' (first publish) and 'published' (update of an
  // already-published post after the user edited content in our app).
  if (variant.status !== "approved" && variant.status !== "published") {
    return {
      error: "Nur freigegebene oder bereits veröffentlichte Varianten können gesendet werden.",
    };
  }

  const metadata = (variant.metadata ?? {}) as Record<string, unknown>;
  const title = (metadata.title as string) || "Ohne Titel";
  const slug = (metadata.slug as string) || undefined;
  const excerpt = (metadata.excerpt as string) || undefined;
  const metaDescription = (metadata.meta_description as string) || undefined;
  const tagNames = (metadata.suggested_tags as string[] | undefined) ?? [];
  const content = variant.body;

  // If this variant already has a WP post ID, we're updating instead of creating
  const existingWpPostId =
    typeof metadata.wp_post_id === "number" ? metadata.wp_post_id : null;
  const isUpdate = existingWpPostId != null;

  // Fetch an image for this project. Preference:
  //  1. One explicitly marked as is_featured=true
  //  2. Otherwise the most recently created image for this project
  let featuredMediaId: number | undefined;
  const { data: candidates } = await supabase
    .from("images")
    .select("id, storage_path, is_featured, wp_media_id, created_at")
    .eq("project_id", projectId)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  const pick = candidates?.[0];
  if (pick?.storage_path) {
    // If this image already has a wp_media_id (was uploaded before),
    // reuse it instead of re-uploading every time the user updates
    // the post.
    if (pick.wp_media_id) {
      featuredMediaId = pick.wp_media_id;
      console.log(
        `[publishBlogToWordpress] reusing existing wp_media_id=${pick.wp_media_id}`,
      );
    } else {
      console.log(
        `[publishBlogToWordpress] uploading image ${pick.id} (featured=${pick.is_featured})`,
      );
      const admin = getSupabaseAdmin();
      const { data: fileData, error: dlErr } = await admin.storage
        .from("generated-images")
        .download(pick.storage_path);
      if (dlErr) {
        return {
          error: `Beitragsbild-Download fehlgeschlagen: ${dlErr.message}`,
        };
      }
      const arr = await fileData.arrayBuffer();
      const buffer = Buffer.from(arr);
      const contentType = pick.storage_path.endsWith(".webp")
        ? "image/jpeg" // WP media upload doesn't love webp — fake as jpg
        : pick.storage_path.endsWith(".jpg") ||
            pick.storage_path.endsWith(".jpeg")
          ? "image/jpeg"
          : "image/png";
      try {
        const uploaded = await uploadMedia(
          creds,
          `${slug || "blog-image"}.${contentType === "image/jpeg" ? "jpg" : "png"}`,
          buffer,
          contentType as "image/png" | "image/jpeg",
        );
        featuredMediaId = uploaded.id;
        console.log(
          `[publishBlogToWordpress] uploaded to WP media id=${uploaded.id}`,
        );
        await supabase
          .from("images")
          .update({ wp_media_id: uploaded.id, is_featured: true })
          .eq("id", pick.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { error: `WP Bild-Upload fehlgeschlagen: ${msg}` };
      }
    }
  } else {
    console.log(
      `[publishBlogToWordpress] no image for project ${projectId}, skipping featured image`,
    );
  }

  // Create post OR update existing one
  let post;
  try {
    const wpInput = {
      title,
      content,
      excerpt,
      slug,
      featuredMediaId,
      tagNames,
      metaDescription,
      status,
      date: dateIso ?? undefined,
    };
    post = isUpdate
      ? await updatePost(creds, existingWpPostId!, wpInput)
      : await createPost(creds, wpInput);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      error: `WP Post ${isUpdate ? "update" : "create"} fehlgeschlagen: ${msg}`,
    };
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
    wpFeaturedMediaId: featuredMediaId ?? null,
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
