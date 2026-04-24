"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { getOpenAI, OPENAI_IMAGE_MODEL } from "@/lib/openai/client";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadWpCredentials } from "@/lib/wordpress/credentials";
import {
  uploadMedia,
  createPost,
  updatePost,
  fetchWordpressCategoryNames,
} from "@/lib/wordpress/client";
import { generateVariantsForChannels } from "@/lib/openai/generate-variants";
import { assertImageMatches } from "@/lib/security/image-magic";
import { assertPublicHttpUrl } from "@/lib/security/url-guard";
import { applyNoteToBody } from "@/lib/openai/apply-note";
import { sendReviewInviteEmail } from "@/lib/email/send-review-invite";

export async function renameProject(projectId: string, topic: string) {
  const { supabase, user, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor dürfen Projekte umbenennen." };
  }
  const trimmed = topic.trim();
  if (!trimmed) return { error: "Titel darf nicht leer sein." };
  if (trimmed.length > 200) return { error: "Titel maximal 200 Zeichen." };

  const { error } = await supabase
    .from("content_projects")
    .update({ topic: trimmed, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "project_renamed",
    target_type: "content_project",
    target_id: projectId,
    payload: { topic: trimmed },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { ok: true };
}
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  type Channel,
  type ContentVariant,
  type VariantStatus,
  type VariantVersionReason,
} from "@/lib/supabase/types";

// =====================================================================
// Variant body / status actions
// =====================================================================

export async function updateVariantBody(
  variantId: string,
  body: string,
  metadata: Record<string, unknown> | null,
) {
  const { supabase, user, profile } = await requireUser();
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
    .update({ body, metadata, updated_by: user.id })
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

  // Admins + editors can set any status manually (including going
  // backwards from published → draft). Reviewers can set the review
  // workflow statuses but not mark something as published.
  if (profile.role === "reviewer" && status === "published") {
    return { error: "Reviewer können nicht veröffentlichen." };
  }
  if (
    profile.role !== "admin" &&
    profile.role !== "editor" &&
    profile.role !== "reviewer"
  ) {
    return { error: "Kein Zugriff." };
  }

  // Load the whole variant so we can (a) revalidate the project
  // route and (b) feed it back into source_posts as a featured
  // reference on approval.
  const { data: variant } = await supabase
    .from("content_variants")
    .select("*")
    .eq("id", variantId)
    .single();

  const update: Partial<ContentVariant> = { status };
  if (status === "approved") {
    update.reviewed_by = user.id;
    update.reviewed_at = new Date().toISOString();
  }
  if (status === "published") {
    const existing = variant as ContentVariant | null;
    if (!existing?.published_at) {
      update.published_at = new Date().toISOString();
    }
  }

  const { error } = await supabase
    .from("content_variants")
    .update(update)
    .eq("id", variantId);

  if (error) return { error: error.message };

  // Feedback loop: whenever a variant gets freshly approved, mirror
  // it into source_posts as a featured reference so future
  // generations pick it up in few-shot sampling. Using upsert with
  // a deterministic external_id means re-approving the same variant
  // just refreshes the row — no duplicates.
  if (status === "approved" && variant) {
    const v = variant as ContentVariant;
    const { data: project } = await supabase
      .from("content_projects")
      .select("topic")
      .eq("id", v.project_id)
      .single();
    const topic = (project as { topic: string } | null)?.topic ?? null;

    // For channels that use metadata.title (blog, newsletter), prefer
    // that over the project topic so the source_posts row is
    // self-descriptive.
    const metaTitle =
      (v.metadata?.title as string | undefined) ??
      (v.metadata?.subject as string | undefined) ??
      null;
    const sourceTitle = metaTitle ?? topic;

    await supabase.from("source_posts").upsert(
      {
        source: "approved_variant",
        external_id: `variant_${v.id}`,
        url: null,
        title: sourceTitle,
        body: v.body,
        published_at: v.reviewed_at ?? new Date().toISOString(),
        imported_at: new Date().toISOString(),
        channel: v.channel,
        is_featured: true,
      },
      { onConflict: "source,external_id" },
    );
    revalidatePath("/library/sources");
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: `variant_status_${status}`,
    target_type: "content_variant",
    target_id: variantId,
  });

  if (variant) revalidatePath(`/projects/${variant.project_id}`);
  return { ok: true };
}

export async function setVariantSchedule(
  variantId: string,
  scheduledAt: string | null,
) {
  const { supabase, user, profile } = await requireUser();

  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor dürfen Posts einplanen." };
  }

  // Normalize: accept ISO strings or `YYYY-MM-DDTHH:mm` from
  // <input type="datetime-local">. An empty string clears the
  // schedule (for when a user wants to un-plan a post).
  let normalized: string | null = null;
  if (scheduledAt && scheduledAt.trim() !== "") {
    const d = new Date(scheduledAt);
    if (Number.isNaN(d.getTime())) {
      return { error: "Ungültiges Datum." };
    }
    normalized = d.toISOString();
  }

  const { data: variant } = await supabase
    .from("content_variants")
    .select("project_id")
    .eq("id", variantId)
    .single();

  const { error } = await supabase
    .from("content_variants")
    .update({ scheduled_at: normalized, updated_by: user.id })
    .eq("id", variantId);

  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: normalized ? "variant_scheduled" : "variant_unscheduled",
    target_type: "content_variant",
    target_id: variantId,
  });

  if (variant) revalidatePath(`/projects/${variant.project_id}`);
  revalidatePath("/calendar");
  return { ok: true };
}

// =====================================================================
// Blog image actions (gpt-image-1)
// =====================================================================

// =====================================================================
// Blog image prompt + brand overlay pipeline
//
// Generated images go through THREE steps:
//  1. OpenAI gpt-image-1 with a HYPERREALISTIC photographic prompt
//     at quality: "high" (most realism dial the API exposes)
//  2. Server-side sharp compositing: a KnowOn brand gradient overlay
//     (purple → teal) is applied on top as a translucent wash
//  3. The admin-uploaded brand logo from brand_voice.logo_path is
//     composited 1:1 (no recoloring) into the bottom-right corner.
//     Falls back to a rendered SVG "KnowOn" wordmark if no logo
//     has been uploaded yet.
// =====================================================================

const BRAND_STYLE_SUFFIX =
  "Fotorealistische, hochauflösende redaktionelle Fotografie im Dokumentarstil. Authentisches medizinisches Umfeld (Augenarztpraxis, Sprechstunde, Augenuntersuchung, Team-Interaktion, moderne Praxiseinrichtung). Natürliches weiches Tageslicht, feine Hauttextur, echte Mimik und Körpersprache, realistische Materialien (Kittel, medizinische Geräte, Glas, Metall). Geringe Schärfentiefe mit cremigem Bokeh, 50mm-Objektiv-Look, ruhige Komposition, professioneller Weißabgleich. Aufgenommen wie mit einer hochwertigen Spiegelreflex, 8K-Detailgrad, natürliche Farben. 3:2 Querformat, wichtiges Motiv leicht mittig-links, damit rechts unten Platz für eine kleine Logo-Einblendung bleibt. ABSOLUT KEIN Text, KEINE Schrift, KEINE Logos, KEINE Wasserzeichen, KEINE Illustrationen, KEINE 3D-Renderings, KEINE Cartoons, KEINE AI-typischen Artefakte (keine zusätzlichen Finger, keine verzerrten Gesichter, keine schwebenden Objekte).";

// KnowOn official brand colors (also in tailwind.config.ts)
const KNOWON_TEAL = "#0097A7";
const KNOWON_PURPLE = "#392054";

// Horizontal wash: Purple (left) → Teal (right). Kept slightly
// softer than before so more of the photo detail shines through —
// higher realism even with the overlay on top.
const OVERLAY_OPACITY_PURPLE = 0.72;
const OVERLAY_OPACITY_TEAL = 0.68;

/** Gradient-only SVG used as the first composite layer. */
function buildBrandGradientSvg(width: number, height: number): string {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="knowon-brand" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${KNOWON_PURPLE}" stop-opacity="${OVERLAY_OPACITY_PURPLE}"/>
      <stop offset="100%" stop-color="${KNOWON_TEAL}" stop-opacity="${OVERLAY_OPACITY_TEAL}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#knowon-brand)"/>
</svg>`;
}

/**
 * Fallback wordmark — only rendered when the admin hasn't uploaded a
 * brand logo yet. Same layout as before the logo-upload feature
 * existed, so previously generated images still look consistent.
 */
function buildFallbackWordmarkSvg(width: number, height: number): string {
  const logoWidth = Math.round(width * 0.22);
  const logoHeight = Math.round(logoWidth * 0.3);
  const padX = Math.round(width * 0.025);
  const padY = Math.round(height * 0.035);
  const logoX = width - logoWidth - padX;
  const logoY = height - logoHeight - padY;

  const scale = logoWidth / 100;
  const midY = logoHeight * 0.68;
  const textSize = logoHeight * 1.0;
  const strokeW = Math.max(4, Math.round(logoHeight * 0.14));
  const circleR = logoHeight * 0.35;
  const circleCx = 67 * scale;
  const circleCy = logoHeight * 0.48;
  const lineTopY = logoHeight * 0.04;
  const lineBotY = circleCy - 1;

  const arcStartX = circleCx - circleR * 0.55;
  const arcStartY = circleCy - circleR * 0.82;
  const arcEndX = circleCx + circleR * 0.55;
  const arcEndY = circleCy - circleR * 0.82;

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${logoX}, ${logoY})">
    <text x="0" y="${midY}" font-family="'Arial Black', Arial, Helvetica, sans-serif" font-size="${textSize}" font-weight="900" fill="white">Know</text>
    <g fill="none" stroke="white" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M ${arcStartX} ${arcStartY} A ${circleR} ${circleR} 0 1 0 ${arcEndX} ${arcEndY}"/>
      <line x1="${circleCx}" y1="${lineTopY}" x2="${circleCx}" y2="${lineBotY}"/>
    </g>
    <text x="${80 * scale}" y="${midY}" font-family="'Arial Black', Arial, Helvetica, sans-serif" font-size="${textSize}" font-weight="900" fill="white">n</text>
  </g>
</svg>`;
}

/**
 * Loads the admin-uploaded brand logo from storage (if any). Returns
 * `null` if no logo is set or the download fails — the caller then
 * uses the fallback SVG wordmark.
 */
async function loadBrandLogoBuffer(): Promise<Buffer | null> {
  try {
    const admin = getSupabaseAdmin();
    const { data: voice } = await admin
      .from("brand_voice")
      .select("logo_path")
      .eq("id", 1)
      .single();
    const path = (voice as { logo_path: string | null } | null)?.logo_path;
    if (!path) return null;
    const { data: file, error } = await admin.storage
      .from("generated-images")
      .download(path);
    if (error || !file) return null;
    return Buffer.from(await file.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Applies the KnowOn brand-gradient overlay + brand logo to a raw
 * image buffer. The logo is placed bottom-right and rendered 1:1
 * (transparency preserved, no recoloring) — only scaled so it fits
 * ~22% of the image width.
 */
async function applyBrandOverlay(raw: Buffer): Promise<Buffer> {
  const base = sharp(raw, { failOn: "none" });
  const meta = await base.metadata();
  const width = meta.width ?? 1536;
  const height = meta.height ?? 1024;

  // Layer 1: gradient wash
  const gradient = Buffer.from(buildBrandGradientSvg(width, height));

  // Layer 2: brand logo (or fallback wordmark)
  const logoTargetWidth = Math.round(width * 0.22);
  const padX = Math.round(width * 0.025);
  const padY = Math.round(height * 0.035);

  const logoRaw = await loadBrandLogoBuffer();
  let logoInput: Buffer;
  if (logoRaw) {
    // Resize the uploaded logo to the target width, preserving aspect
    // ratio and transparency. `fit: inside` means we never upscale
    // beyond the logo's native resolution, so a small logo stays
    // crisp instead of getting blurry. Sharp handles SVG, PNG, WebP
    // and JPG transparently here.
    logoInput = await sharp(logoRaw, {
      failOn: "none",
      density: 300, // high DPI for crisp SVG rasterization
    })
      .resize({ width: logoTargetWidth, fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
  } else {
    logoInput = Buffer.from(buildFallbackWordmarkSvg(width, height));
  }

  // Build the composite list — gradient first (full frame), then
  // logo at the pinned position.
  const composites: sharp.OverlayOptions[] = [
    { input: gradient, blend: "over" },
  ];
  if (logoRaw) {
    // Measure the logo so we can pin it to the bottom-right.
    const logoMeta = await sharp(logoInput).metadata();
    const lw = logoMeta.width ?? logoTargetWidth;
    const lh = logoMeta.height ?? Math.round(logoTargetWidth * 0.3);
    composites.push({
      input: logoInput,
      left: Math.max(0, width - lw - padX),
      top: Math.max(0, height - lh - padY),
      blend: "over",
    });
  } else {
    // Fallback wordmark SVG already contains its own positioning,
    // so we paint it full-frame.
    composites.push({ input: logoInput, blend: "over" });
  }

  return base.composite(composites).png().toBuffer();
}

type ImageSize = "1024x1024" | "1536x1024";

interface GenerateImageResult {
  imageId?: string;
  signedUrl?: string;
  storagePath?: string;
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
    // gpt-image-1 returns base64 by default (no response_format param needed).
    // `quality: "high"` is the biggest realism lever the API exposes —
    // worth the extra cost for blog/hero images that double as OG cards.
    const resp = await openai.images.generate({
      model: OPENAI_IMAGE_MODEL,
      prompt: finalPrompt,
      size,
      quality: "high",
      n: 1,
    });
    const first = resp.data?.[0];
    if (!first) return { error: "OpenAI hat kein Bild zurückgegeben." };
    if ("b64_json" in first && typeof first.b64_json === "string") {
      imageBase64 = first.b64_json;
    } else if ("url" in first && typeof first.url === "string") {
      // Some API versions return URL instead of base64 — download it.
      // Guard against a manipulated / MITM'd response that might
      // point at an internal metadata endpoint (SSRF).
      const guard = assertPublicHttpUrl(first.url);
      if (!guard.ok) {
        return {
          error: `Unerwartete Bild-URL blockiert: ${guard.error}`,
        };
      }
      const res = await fetch(guard.url.toString());
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

  const rawBuffer = Buffer.from(imageBase64, "base64");

  // Apply KnowOn brand gradient overlay (baked into the PNG)
  let finalBuffer: Buffer;
  try {
    finalBuffer = await applyBrandOverlay(rawBuffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generateBlogImage] overlay composite failed", msg);
    // Fall back to raw image if overlay fails — better than total failure
    finalBuffer = rawBuffer;
  }

  const filename = `${projectId}/${crypto.randomUUID()}.png`;

  const { error: uploadErr } = await supabase.storage
    .from("generated-images")
    .upload(filename, finalBuffer, {
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
    return {
      error: `Bild-Metadaten konnten nicht gespeichert werden: ${insertErr?.message ?? "unbekannter Fehler"}`,
    };
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
    storagePath: filename,
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

  const rawBuffer = Buffer.from(await file.arrayBuffer());

  // Magic-byte verification — `file.type` from the browser is not
  // trustworthy. Before we hand the buffer to sharp or Supabase
  // storage we make sure it's actually one of the formats we allow
  // (PNG / JPEG / WebP for blog images — no SVG here, we don't want
  // active content in blog hero images).
  const magic = assertImageMatches(rawBuffer, file.type, [
    "png",
    "jpeg",
    "webp",
  ]);
  if (!magic.ok) return { error: magic.error };

  // Uploaded images also get the KnowOn brand overlay + logo baked in —
  // same treatment as AI-generated ones, so everything in the blog
  // looks consistent.
  let finalBuffer: Buffer;
  try {
    finalBuffer = await applyBrandOverlay(rawBuffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[uploadBlogImage] overlay composite failed", msg);
    finalBuffer = rawBuffer;
  }

  // After overlay we always store as PNG (sharp normalizes output)
  const filename = `${projectId}/${crypto.randomUUID()}.png`;

  const { error: uploadErr } = await supabase.storage
    .from("generated-images")
    .upload(filename, finalBuffer, {
      contentType: "image/png",
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
    console.error("[uploadBlogImage] insert error", insertErr);
    await supabase.storage.from("generated-images").remove([filename]);
    return {
      error: `Bild-Metadaten konnten nicht gespeichert werden: ${insertErr?.message ?? "unbekannter Fehler"}`,
    };
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
    storagePath: filename,
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
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor dürfen Bilder löschen." };
  }

  const { data: img } = await supabase
    .from("images")
    .select("storage_path, project_id")
    .eq("id", imageId)
    .single();
  if (!img) return { error: "Bild nicht gefunden." };

  // storage_path is nullable now (URL-only images live purely in the
  // DB row). Only hit storage when there's actually a file there.
  if (img.storage_path) {
    await supabase.storage
      .from("generated-images")
      .remove([img.storage_path]);
  }
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
  const categoryNames =
    (metadata.suggested_categories as string[] | undefined) ?? [];
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
      categoryNames,
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
// Variant notes — internal thread per channel variant. Any team
// member can add; only the note author (or an admin) can delete.
// =====================================================================

const MAX_NOTE_LEN = 2000;

export async function addVariantNote(variantId: string, body: string) {
  const { supabase, user } = await requireUser();

  const trimmed = body.trim();
  if (!trimmed) return { error: "Notiz darf nicht leer sein." };
  if (trimmed.length > MAX_NOTE_LEN) {
    return { error: `Notiz zu lang (max ${MAX_NOTE_LEN} Zeichen).` };
  }

  const { data: variant } = await supabase
    .from("content_variants")
    .select("project_id")
    .eq("id", variantId)
    .single();
  if (!variant) return { error: "Variante nicht gefunden." };

  const { error } = await supabase.from("variant_notes").insert({
    variant_id: variantId,
    body: trimmed,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath(`/projects/${variant.project_id}`);
  return { ok: true };
}

export async function deleteVariantNote(noteId: string) {
  const { supabase, user, profile } = await requireUser();

  // Need the variant's project_id for revalidation, and the note's
  // created_by for the permission check. One query via join.
  const { data: note } = await supabase
    .from("variant_notes")
    .select("created_by, content_variants!inner(project_id)")
    .eq("id", noteId)
    .single();
  if (!note) return { error: "Notiz nicht gefunden." };

  const canDelete =
    profile.role === "admin" || note.created_by === user.id;
  if (!canDelete) return { error: "Kein Zugriff." };

  const { error } = await supabase
    .from("variant_notes")
    .delete()
    .eq("id", noteId);
  if (error) return { error: error.message };

  // PostgREST's typed client returns joined relations as either a
  // single object or a one-element array depending on FK shape
  // detection. Narrow explicitly so we don't need an `any`-cast.
  type Joined =
    | { project_id: string }
    | { project_id: string }[]
    | null
    | undefined;
  const cv = (note as { content_variants?: Joined }).content_variants;
  const projectId = Array.isArray(cv) ? cv[0]?.project_id : cv?.project_id;
  if (projectId) revalidatePath(`/projects/${projectId}`);

  return { ok: true };
}

// =====================================================================
// WordPress categories list — used by the variant editor to show
// existing WP categories as a quick-pick. Best-effort: returns []
// if WP isn't configured or unreachable. Never throws to the client.
// =====================================================================

export async function listWpCategoryNames(): Promise<
  { names: string[] } | { error: string }
> {
  await requireUser();
  try {
    const creds = await loadWpCredentials();
    if (!creds) return { names: [] };
    const names = await fetchWordpressCategoryNames(creds);
    return { names };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "WP unerreichbar" };
  }
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
    return { error: "Nur Admin oder Ersteller darf löschen." };
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

// =====================================================================
// Delete a single variant + add new channels to existing project
// =====================================================================

export async function deleteVariant(variantId: string) {
  const { supabase, user, profile } = await requireUser();

  const { data: variant } = await supabase
    .from("content_variants")
    .select("id, project_id, channel, project:content_projects(created_by)")
    .eq("id", variantId)
    .single();

  if (!variant) return { error: "Variante nicht gefunden." };

  // PostgREST returns the joined `project:` relation as a single
  // object or a one-element array depending on detected cardinality.
  type JoinedProject =
    | { created_by: string | null }
    | { created_by: string | null }[]
    | null
    | undefined;
  const joined = (variant as { project?: JoinedProject }).project;
  const project = Array.isArray(joined) ? joined[0] : joined;
  const isOwner = project?.created_by === user.id;
  if (profile.role !== "admin" && !isOwner) {
    return { error: "Nur Admin oder Ersteller darf Varianten löschen." };
  }

  // Cascade: deleting the variant row removes all its versions via the
  // unique (project_id, channel, version) — but we only delete the
  // specific version. Drop ALL versions of this channel in this project
  // so the channel is truly gone.
  const { error: delErr } = await supabase
    .from("content_variants")
    .delete()
    .eq("project_id", variant.project_id)
    .eq("channel", variant.channel);
  if (delErr) return { error: delErr.message };

  // Also remove this channel from requested_channels so aggregation UI
  // stops counting it.
  const { data: proj } = await supabase
    .from("content_projects")
    .select("requested_channels")
    .eq("id", variant.project_id)
    .single();

  if (proj?.requested_channels) {
    const nextChannels = (proj.requested_channels as Channel[]).filter(
      (c) => c !== variant.channel,
    );
    await supabase
      .from("content_projects")
      .update({ requested_channels: nextChannels })
      .eq("id", variant.project_id);
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "variant_deleted",
    target_type: "content_variant",
    target_id: variantId,
    payload: { channel: variant.channel, project_id: variant.project_id },
  });

  revalidatePath(`/projects/${variant.project_id}`);
  return { ok: true };
}

export async function addChannelsToProject(
  projectId: string,
  channels: Channel[],
) {
  const { supabase, user, profile } = await requireUser();

  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor dürfen Kanäle hinzufügen." };
  }

  const validChannels = channels.filter((c) =>
    (ALL_CHANNELS as string[]).includes(c),
  );
  if (validChannels.length === 0) {
    return { error: "Keine gültigen Kanäle angegeben." };
  }

  // Load the project
  const { data: project } = await supabase
    .from("content_projects")
    .select("id, topic, brief, requested_channels")
    .eq("id", projectId)
    .single();
  if (!project) return { error: "Projekt nicht gefunden." };

  // Filter out channels that already exist
  const existing = new Set<Channel>(
    (project.requested_channels ?? []) as Channel[],
  );
  const toGenerate = validChannels.filter((c) => !existing.has(c));
  if (toGenerate.length === 0) {
    return { error: "Alle gewählten Kanäle gibt es schon in diesem Projekt." };
  }

  const result = await generateVariantsForChannels({
    topic: project.topic,
    brief: project.brief,
    channels: toGenerate,
    supabase,
  });
  if ("error" in result) return { error: result.error };

  const variantRows = result.rows.map((r) => ({
    project_id: projectId,
    channel: r.channel,
    version: 1,
    body: r.body,
    metadata: r.metadata,
    status: "draft" as const,
    created_by: user.id,
  }));

  const { error: insertErr } = await supabase
    .from("content_variants")
    .insert(variantRows);
  if (insertErr) return { error: insertErr.message };

  // Update requested_channels
  const nextRequested = [...existing, ...toGenerate];
  await supabase
    .from("content_projects")
    .update({ requested_channels: nextRequested })
    .eq("id", projectId);

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "channels_added",
    target_type: "content_project",
    target_id: projectId,
    payload: { added: toGenerate },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, added: toGenerate };
}

// =====================================================================
// Project-level workflow (assignment, review, approval)
// =====================================================================

/**
 * Snapshot a variant's current body+metadata into variant_versions
 * before mutating it. Keeps the full audit trail so regenerations
 * and AI edits can be undone. Caller must pass the reason for the
 * snapshot so the history UI can label each row.
 */
async function snapshotVariant(
  // Supabase's generated generics are deeply nested and vary per
  // schema; we only touch two tables here, so the loosest shared
  // shape is fine.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  variantId: string,
  userId: string,
  reason: VariantVersionReason,
): Promise<{ nextVersion: number } | { error: string }> {
  const { data: variant, error: readErr } = await supabase
    .from("content_variants")
    .select("version, body, metadata")
    .eq("id", variantId)
    .single();
  if (readErr || !variant) return { error: "Variante nicht gefunden." };

  const { error: snapErr } = await supabase
    .from("variant_versions")
    .insert({
      variant_id: variantId,
      version: variant.version,
      body: variant.body,
      metadata: variant.metadata,
      created_by: userId,
      reason,
    });
  if (snapErr) return { error: snapErr.message };

  return { nextVersion: (variant.version ?? 1) + 1 };
}

export async function assignProject(
  projectId: string,
  userId: string | null,
) {
  const { supabase, user, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor dürfen zuweisen." };
  }

  const { error } = await supabase
    .from("content_projects")
    .update({ assigned_to: userId })
    .eq("id", projectId);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: userId ? "project_assigned" : "project_unassigned",
    target_type: "content_project",
    target_id: projectId,
    payload: { assigned_to: userId },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function sendProjectToReview(
  projectId: string,
  options: { channels: Channel[]; assigneeId: string | null },
) {
  const { supabase, user, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor dürfen Projekte zur Review senden." };
  }

  if (options.channels.length === 0) {
    return { error: "Mindestens einen Kanal auswählen." };
  }

  // Only flip variants that are currently in draft. We never downgrade
  // an approved/published variant to in_review automatically — the
  // UI hides those from the checklist so this is mostly a safety net.
  const { data: variants, error: varErr } = await supabase
    .from("content_variants")
    .select("id, channel, status")
    .eq("project_id", projectId)
    .in("channel", options.channels)
    .eq("status", "draft");
  if (varErr) return { error: varErr.message };

  const ids = (variants ?? []).map((v) => (v as { id: string }).id);
  if (ids.length === 0) {
    return { error: "Keine draft-Kanäle zum Umstellen gefunden." };
  }

  const { error: updErr } = await supabase
    .from("content_variants")
    .update({ status: "in_review", updated_by: user.id })
    .in("id", ids);
  if (updErr) return { error: updErr.message };

  const { error: projErr } = await supabase
    .from("content_projects")
    .update({
      status: "in_review",
      review_requested_at: new Date().toISOString(),
      assigned_to: options.assigneeId,
    })
    .eq("id", projectId);
  if (projErr) return { error: projErr.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "project_sent_to_review",
    target_type: "content_project",
    target_id: projectId,
    payload: {
      channels: options.channels,
      variant_ids: ids,
      assignee: options.assigneeId,
    },
  });

  // Benachrichtige den Reviewer per E-Mail. Der Mail-Versand ist
  // best-effort — die Review ist bereits gespeichert. Fehler werden
  // ins Audit-Log geschrieben, damit Admins Zustellungsprobleme sehen.
  let mailStatus: "sent" | "failed" | "skipped" = "skipped";
  if (options.assigneeId && options.assigneeId !== user.id) {
    const { data: projectRow } = await supabase
      .from("content_projects")
      .select("topic")
      .eq("id", projectId)
      .single();
    const mail = await sendReviewInviteEmail({
      projectId,
      projectTopic:
        (projectRow as { topic: string } | null)?.topic ?? "Unbenanntes Projekt",
      reviewerUserId: options.assigneeId,
      requesterName: profile.full_name,
    });
    if ("error" in mail) {
      mailStatus = "failed";
      await supabase.from("audit_log").insert({
        actor: user.id,
        action: "review_invite_email_failed",
        target_type: "content_project",
        target_id: projectId,
        payload: { assignee: options.assigneeId, reason: mail.error },
      });
    } else {
      mailStatus = "sent";
    }
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/review");
  return { ok: true, count: ids.length, mailStatus };
}

export async function approveProject(
  projectId: string,
  options: { assigneeId: string | null },
) {
  const { supabase, user, profile } = await requireUser();

  if (
    profile.role !== "admin" &&
    profile.role !== "reviewer" &&
    profile.role !== "editor"
  ) {
    return { error: "Kein Zugriff." };
  }

  // Freigabe wirkt auf alle Varianten im Status in_review. Die anderen
  // bleiben, wie sie sind — ein bereits veröffentlichter Kanal wird
  // nicht zurück auf approved gestuft, ein noch-draft Kanal darf nicht
  // ohne Review freigegeben werden.
  const { data: variants, error: varErr } = await supabase
    .from("content_variants")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "in_review");
  if (varErr) return { error: varErr.message };

  const ids = (variants ?? []).map((v) => (v as { id: string }).id);
  if (ids.length === 0) {
    return { error: "Keine Kanäle in Review." };
  }

  const now = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("content_variants")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: now,
      updated_by: user.id,
    })
    .in("id", ids);
  if (updErr) return { error: updErr.message };

  // Project status mirrors the "furthest" lifecycle stage of its
  // variants. If everything is approved or better, the project flips
  // to approved. Still-draft channels hold the project in mixed state,
  // which we represent by leaving project.status at in_review.
  const { data: remaining } = await supabase
    .from("content_variants")
    .select("status")
    .eq("project_id", projectId);
  const statuses = (remaining ?? []).map(
    (r) => (r as { status: VariantStatus }).status,
  );
  const projectStatus: VariantStatus = statuses.every(
    (s) => s === "approved" || s === "published",
  )
    ? "approved"
    : statuses.some((s) => s === "in_review")
      ? "in_review"
      : "draft";

  const { error: projErr } = await supabase
    .from("content_projects")
    .update({
      status: projectStatus,
      assigned_to: options.assigneeId,
    })
    .eq("id", projectId);
  if (projErr) return { error: projErr.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "project_approved",
    target_type: "content_project",
    target_id: projectId,
    payload: {
      variant_ids: ids,
      next_assignee: options.assigneeId,
      project_status: projectStatus,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/review");
  revalidatePath("/dashboard");
  return { ok: true, count: ids.length };
}

// =====================================================================
// Regenerate actions (global + per-channel)
// =====================================================================

export async function regenerateVariantsForProject(
  projectId: string,
  options: { channels: Channel[]; extraPrompt?: string | null },
) {
  const { supabase, user, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Reviewer dürfen nicht regenerieren." };
  }
  if (options.channels.length === 0) {
    return { error: "Mindestens einen Kanal auswählen." };
  }

  const { data: project } = await supabase
    .from("content_projects")
    .select("topic, brief")
    .eq("id", projectId)
    .single();
  if (!project) return { error: "Projekt nicht gefunden." };

  const result = await generateVariantsForChannels({
    topic: (project as { topic: string }).topic,
    brief: (project as { brief: string | null }).brief,
    channels: options.channels,
    extraPrompt: options.extraPrompt ?? null,
    supabase,
  });
  if ("error" in result) return { error: result.error };

  // Map existing variants by channel so we know which rows to update
  // vs. which channels got added fresh (if someone picked a channel
  // that didn't exist yet — defensive; the UI only shows existing).
  const { data: existing } = await supabase
    .from("content_variants")
    .select("id, channel, version, body, metadata")
    .eq("project_id", projectId)
    .in("channel", options.channels);
  const byChannel = new Map<
    Channel,
    { id: string; version: number; body: string; metadata: unknown }
  >();
  for (const row of existing ?? []) {
    const r = row as {
      id: string;
      channel: Channel;
      version: number;
      body: string;
      metadata: unknown;
    };
    byChannel.set(r.channel, r);
  }

  const reason: VariantVersionReason =
    options.channels.length > 1 ? "regenerate_all" : "regenerate_channel";

  const updated: string[] = [];
  for (const row of result.rows) {
    const prev = byChannel.get(row.channel);
    if (!prev) continue;

    // Snapshot old body/metadata into variant_versions.
    const snap = await snapshotVariant(supabase, prev.id, user.id, reason);
    if ("error" in snap) {
      console.error("[regenerate] snapshot failed", snap.error);
      continue;
    }

    const { error: updErr } = await supabase
      .from("content_variants")
      .update({
        body: row.body,
        metadata: row.metadata,
        version: snap.nextVersion,
        updated_by: user.id,
      })
      .eq("id", prev.id);
    if (updErr) {
      console.error("[regenerate] update failed", updErr);
      continue;
    }
    updated.push(prev.id);
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "project_regenerated",
    target_type: "content_project",
    target_id: projectId,
    payload: {
      channels: options.channels,
      updated_variant_ids: updated,
      extra_prompt: options.extraPrompt ?? null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, count: updated.length };
}

export async function regenerateVariant(
  variantId: string,
  options: { extraPrompt?: string | null },
) {
  const { supabase, user, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Reviewer dürfen nicht regenerieren." };
  }

  const { data: variant } = await supabase
    .from("content_variants")
    .select("id, channel, project_id")
    .eq("id", variantId)
    .single();
  if (!variant) return { error: "Variante nicht gefunden." };

  const v = variant as {
    id: string;
    channel: Channel;
    project_id: string;
  };

  const res = await regenerateVariantsForProject(v.project_id, {
    channels: [v.channel],
    extraPrompt: options.extraPrompt ?? null,
  });
  return res;
}

// =====================================================================
// Apply a note to the body via AI
// =====================================================================

export async function applyNoteToVariant(variantId: string, noteId: string) {
  const { supabase, user, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Reviewer dürfen Notizen nicht direkt einarbeiten." };
  }

  const { data: variant } = await supabase
    .from("content_variants")
    .select("id, channel, body, project_id, version")
    .eq("id", variantId)
    .single();
  if (!variant) return { error: "Variante nicht gefunden." };

  const { data: note } = await supabase
    .from("variant_notes")
    .select("id, body, applied_to_version")
    .eq("id", noteId)
    .single();
  if (!note) return { error: "Notiz nicht gefunden." };
  const n = note as {
    id: string;
    body: string;
    applied_to_version: number | null;
  };
  if (n.applied_to_version !== null) {
    return { error: `Notiz wurde bereits in v${n.applied_to_version} eingearbeitet.` };
  }

  const v = variant as {
    id: string;
    channel: Channel;
    body: string;
    project_id: string;
    version: number;
  };

  const out = await applyNoteToBody({
    body: v.body,
    note: n.body,
    channelLabel: CHANNEL_LABELS[v.channel],
  });
  if ("error" in out) return { error: out.error };

  const snap = await snapshotVariant(supabase, v.id, user.id, "apply_note");
  if ("error" in snap) return { error: snap.error };

  const { error: updErr } = await supabase
    .from("content_variants")
    .update({
      body: out.body,
      version: snap.nextVersion,
      updated_by: user.id,
    })
    .eq("id", v.id);
  if (updErr) return { error: updErr.message };

  await supabase
    .from("variant_notes")
    .update({ applied_to_version: snap.nextVersion })
    .eq("id", n.id);

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "note_applied",
    target_type: "content_variant",
    target_id: v.id,
    payload: { note_id: n.id, applied_to_version: snap.nextVersion },
  });

  revalidatePath(`/projects/${v.project_id}`);
  return { ok: true, version: snap.nextVersion };
}

// =====================================================================
// Version history: list + restore
// =====================================================================

export async function listVariantVersions(variantId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("variant_versions")
    .select(
      "id, version, body, metadata, reason, created_at, created_by, author:created_by(full_name)",
    )
    .eq("variant_id", variantId)
    .order("version", { ascending: false });
  if (error) return { error: error.message };
  return { versions: data ?? [] };
}

export async function restoreVariantVersion(
  variantId: string,
  versionId: string,
) {
  const { supabase, user, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Reviewer dürfen nicht wiederherstellen." };
  }

  const { data: archived } = await supabase
    .from("variant_versions")
    .select("body, metadata")
    .eq("id", versionId)
    .eq("variant_id", variantId)
    .single();
  if (!archived) return { error: "Version nicht gefunden." };

  // Snapshot the current body before overwriting, so the "current"
  // state is still recoverable via a later restore.
  const snap = await snapshotVariant(
    supabase,
    variantId,
    user.id,
    "manual_edit",
  );
  if ("error" in snap) return { error: snap.error };

  const a = archived as { body: string; metadata: Record<string, unknown> | null };
  const { error: updErr } = await supabase
    .from("content_variants")
    .update({
      body: a.body,
      metadata: a.metadata,
      version: snap.nextVersion,
      updated_by: user.id,
    })
    .eq("id", variantId);
  if (updErr) return { error: updErr.message };

  const { data: v } = await supabase
    .from("content_variants")
    .select("project_id")
    .eq("id", variantId)
    .single();
  const projectId = (v as { project_id: string } | null)?.project_id;

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "variant_version_restored",
    target_type: "content_variant",
    target_id: variantId,
    payload: { restored_from: versionId, new_version: snap.nextVersion },
  });

  if (projectId) revalidatePath(`/projects/${projectId}`);
  return { ok: true, version: snap.nextVersion };
}

// =====================================================================
// Variant-level images (upload / paste URL / delete)
//
// Non-blog channels get a simpler image panel — no AI generation, no
// brand overlay. Authors can either upload a file or paste an image
// URL (e.g. a Dropbox/S3/CDN link). Rows live in the same `images`
// table but carry `variant_id` so they render per channel.
// =====================================================================

/**
 * Get the parent project id for a variant — used to gate uploads and
 * to revalidate the correct page.
 */
async function variantProjectId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  variantId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("content_variants")
    .select("project_id")
    .eq("id", variantId)
    .single();
  return (data as { project_id: string } | null)?.project_id ?? null;
}

export async function uploadVariantImage(
  variantId: string,
  formData: FormData,
) {
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

  const projectId = await variantProjectId(supabase, variantId);
  if (!projectId) return { error: "Variante nicht gefunden." };

  const rawBuffer = Buffer.from(await file.arrayBuffer());

  // Magic-byte check: browser-reported MIME is not trustworthy. No
  // SVG allowed (active-content risk), consistent with the blog
  // upload policy.
  const magic = assertImageMatches(rawBuffer, file.type, [
    "png",
    "jpeg",
    "webp",
  ]);
  if (!magic.ok) return { error: magic.error };

  // Preserve the original format — no brand overlay for non-blog
  // channels; authors want the raw asset they control.
  const ext = file.type === "image/png"
    ? "png"
    : file.type === "image/webp"
      ? "webp"
      : "jpg";
  const filename = `variant/${variantId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("generated-images")
    .upload(filename, rawBuffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadErr) {
    return { error: `Upload fehlgeschlagen: ${uploadErr.message}` };
  }

  const { error: insertErr } = await supabase.from("images").insert({
    project_id: projectId,
    variant_id: variantId,
    prompt: `Upload: ${file.name}`,
    storage_path: filename,
    external_url: null,
    is_featured: false,
    created_by: user.id,
  });

  if (insertErr) {
    console.error("[uploadVariantImage] insert error", insertErr);
    await supabase.storage.from("generated-images").remove([filename]);
    return {
      error: `Bild-Metadaten konnten nicht gespeichert werden: ${insertErr.message}`,
    };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function addVariantImageByUrl(variantId: string, url: string) {
  const { supabase, user, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor können Bilder verlinken." };
  }

  const trimmed = url.trim();
  if (!trimmed) return { error: "URL ist leer." };

  // Syntactic check only — no server-side fetch, so no SSRF risk.
  // The URL is embedded in an <img> tag on the client; the user's
  // browser does the actual fetch when the card renders.
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: "Ungültige URL." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { error: "Nur http(s)-URLs sind erlaubt." };
  }

  const projectId = await variantProjectId(supabase, variantId);
  if (!projectId) return { error: "Variante nicht gefunden." };

  const { error } = await supabase.from("images").insert({
    project_id: projectId,
    variant_id: variantId,
    prompt: `URL: ${parsed.hostname}`,
    storage_path: null,
    external_url: parsed.toString(),
    is_featured: false,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
