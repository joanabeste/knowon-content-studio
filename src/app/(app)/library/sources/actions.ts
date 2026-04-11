"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { fetchWordpressPosts, stripHtml } from "@/lib/wordpress/client";
import { scrapeEyefoxPartnerPage } from "@/lib/eyefox/scraper";
import type { Channel, SourcePostSource } from "@/lib/supabase/types";

const DEFAULT_WP_BASE =
  process.env.WORDPRESS_BASE_URL || "https://www.knowon.de";

// =====================================================================
// WordPress sync
// =====================================================================
export async function syncWordpressPosts(options?: {
  baseUrl?: string;
  limit?: number;
}) {
  const { supabase, user } = await requireRole("admin");
  const baseUrl = options?.baseUrl || DEFAULT_WP_BASE;
  const limit = options?.limit ?? 20;

  let posts;
  try {
    posts = await fetchWordpressPosts(baseUrl, limit);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `WP fetch fehlgeschlagen: ${msg}` };
  }

  if (!posts.length) return { ok: true, synced: 0 };

  const rows = posts.map((p) => ({
    source: "wordpress" as SourcePostSource,
    external_id: String(p.id),
    url: p.link,
    title: stripHtml(p.title.rendered),
    body: stripHtml(p.content.rendered),
    published_at: p.date_gmt ? new Date(p.date_gmt).toISOString() : null,
    imported_at: new Date().toISOString(),
    channel: "blog" as Channel,
    is_featured: false,
  }));

  const { error } = await supabase
    .from("source_posts")
    .upsert(rows, { onConflict: "source,external_id" });
  if (error) return { error: `source_posts: ${error.message}` };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "wp_sync",
    target_type: "source_posts",
    payload: { base_url: baseUrl, synced: posts.length },
  });

  revalidatePath("/library/sources");
  return { ok: true, synced: posts.length };
}

// =====================================================================
// Eyefox scrape
// =====================================================================
export async function syncEyefoxPartnerPage(options?: {
  partnerUrl?: string;
}) {
  const { supabase, user } = await requireRole("admin");
  const partnerUrl =
    options?.partnerUrl ||
    "https://www.eyefox.com/partner/3695/knowon-gmbh";

  let items;
  try {
    items = await scrapeEyefoxPartnerPage(partnerUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Eyefox-Scrape fehlgeschlagen: ${msg}` };
  }
  if (!items.length) {
    return { ok: true, synced: 0 };
  }

  const rows = items.map((item) => ({
    source: "eyefox" as SourcePostSource,
    external_id: item.externalId,
    url: item.url ?? partnerUrl,
    title: item.title,
    body: item.body,
    published_at: item.publishedAt ?? null,
    imported_at: new Date().toISOString(),
    channel: "eyefox" as Channel,
    is_featured: false,
  }));

  const { error } = await supabase
    .from("source_posts")
    .upsert(rows, { onConflict: "source,external_id" });
  if (error) return { error: `source_posts: ${error.message}` };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "eyefox_sync",
    payload: { partner_url: partnerUrl, synced: rows.length },
  });

  revalidatePath("/library/sources");
  return { ok: true, synced: rows.length };
}

// =====================================================================
// URL-paste import (for arbitrary public URLs)
// =====================================================================
export async function importFromUrl(formData: FormData) {
  const { supabase, user } = await requireUser();

  const url = String(formData.get("url") || "").trim();
  const channel = String(formData.get("channel") || "") as Channel;

  if (!url || !/^https?:\/\//.test(url)) {
    return { error: "Bitte eine gültige http(s)-URL angeben." };
  }
  if (
    !["linkedin", "instagram", "eyefox", "newsletter", "blog"].includes(channel)
  ) {
    return { error: "Ungültiger Kanal." };
  }

  let html;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; KnowOnContentStudio/1.0; +https://www.knowon.de)",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return { error: `URL-Fetch fehlgeschlagen: ${res.status}` };
    }
    html = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Fetch-Fehler: ${msg}` };
  }

  // Simple extraction
  const title = extractMeta(html, "og:title") || extractTitleTag(html) || url;
  const description =
    extractMeta(html, "og:description") ||
    extractMeta(html, "description") ||
    "";
  const bodyText = stripTagsKeepText(html);
  const body = [description, bodyText]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 6000);

  if (!body.trim()) {
    return { error: "Konnte keinen Text extrahieren." };
  }

  const { error } = await supabase.from("source_posts").upsert(
    {
      source: "url_import" as SourcePostSource,
      external_id: url,
      url,
      title: title.slice(0, 200),
      body,
      published_at: null,
      imported_at: new Date().toISOString(),
      channel,
      is_featured: false,
    },
    { onConflict: "source,external_id" },
  );
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "url_import",
    payload: { url, channel },
  });

  revalidatePath("/library/sources");
  return { ok: true };
}

// =====================================================================
// Row-level actions
// =====================================================================
export async function toggleFeatured(id: string) {
  const { supabase, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor." };
  }
  const { data: row } = await supabase
    .from("source_posts")
    .select("is_featured")
    .eq("id", id)
    .single();
  if (!row) return { error: "Nicht gefunden." };
  const { error } = await supabase
    .from("source_posts")
    .update({ is_featured: !row.is_featured })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/library/sources");
  return { ok: true };
}

export async function deleteSourcePost(id: string) {
  const { supabase, profile } = await requireUser();
  if (profile.role !== "admin") return { error: "Nur Admin." };
  const { error } = await supabase.from("source_posts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/library/sources");
  return { ok: true };
}

export async function addSourcePostManual(formData: FormData) {
  const { supabase, user, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor." };
  }
  const channel = String(formData.get("channel") || "") as Channel;
  const title = String(formData.get("title") || "").trim() || null;
  const body = String(formData.get("body") || "").trim();
  const urlStr = String(formData.get("url") || "").trim() || null;
  const isFeatured = formData.get("is_featured") === "on";

  if (
    !["linkedin", "instagram", "eyefox", "newsletter", "blog"].includes(channel)
  ) {
    return { error: "Ungültiger Kanal." };
  }
  if (!body) return { error: "Inhalt fehlt." };

  const externalId = `manual_${crypto.randomUUID()}`;
  const { error } = await supabase.from("source_posts").insert({
    source: "manual" as SourcePostSource,
    external_id: externalId,
    url: urlStr,
    title,
    body,
    published_at: null,
    imported_at: new Date().toISOString(),
    channel,
    is_featured: isFeatured,
  });
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "source_post_manual",
    payload: { channel, title },
  });

  revalidatePath("/library/sources");
  return { ok: true };
}

// =====================================================================
// Local HTML helpers (no extra deps)
// =====================================================================
function extractMeta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return null;
}

function extractTitleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1] ? decodeEntities(m[1]).trim() : null;
}

function stripTagsKeepText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}
