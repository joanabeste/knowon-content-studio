"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { fetchWordpressPosts, stripHtml } from "@/lib/wordpress/client";
import { scrapeEyefoxPartnerPage } from "@/lib/eyefox/scraper";
import { assertPublicHttpUrl } from "@/lib/security/url-guard";
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

type ImportOne =
  | { ok: true; url: string; title: string }
  | { ok: false; url: string; error: string };

/** Fetches a single URL and upserts it as a source_post. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importSingleUrl(
  url: string,
  channel: Channel,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<ImportOne> {
  // SSRF guard — reject internal / private / metadata URLs before
  // issuing any fetch. Without this an authenticated team member
  // could trick the Vercel runtime into fetching 169.254.169.254
  // (cloud metadata) and leaking instance credentials.
  const guard = assertPublicHttpUrl(url);
  if (!guard.ok) return { ok: false, url, error: guard.error };

  try {
    const res = await fetch(guard.url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; KnowOnContentStudio/1.0; +https://www.knowon.de)",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok) return { ok: false, url, error: `${res.status}` };
    const html = await res.text();

    const title = extractMeta(html, "og:title") || extractTitleTag(html) || url;
    const description =
      extractMeta(html, "og:description") ||
      extractMeta(html, "description") ||
      "";
    // Readability-style extraction: pick the article container first
    // instead of stripping tags from the whole doc. Cap at 20 KB
    // (was 6 KB) so long blog posts aren't silently truncated.
    const bodyText = extractArticleBody(html);
    const body = [description, bodyText]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 20000);

    if (!body.trim()) return { ok: false, url, error: "Kein Text" };

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
    if (error) return { ok: false, url, error: error.message };
    return { ok: true, url, title: title.slice(0, 100) };
  } catch (err) {
    return {
      ok: false,
      url,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

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

  const result = await importSingleUrl(url, channel, supabase);
  if (!result.ok) return { error: result.error };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "url_import",
    payload: { url, channel },
  });

  revalidatePath("/library/sources");
  return { ok: true };
}

/**
 * Batch-import multiple URLs from a single textarea paste.
 * Input: formData with `urls` (newline-separated) + `channel`.
 * Each URL is processed sequentially (to avoid hammering the target
 * site). Returns per-URL results so the UI can show a mini report.
 */
export async function importFromUrls(formData: FormData) {
  const { supabase, user } = await requireUser();

  const rawUrls = String(formData.get("urls") || "");
  const channel = String(formData.get("channel") || "") as Channel;

  if (
    !["linkedin", "instagram", "eyefox", "newsletter", "blog"].includes(channel)
  ) {
    return { error: "Ungültiger Kanal." };
  }

  const urls = rawUrls
    .split(/\s+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));

  if (urls.length === 0) {
    return { error: "Keine gültigen URLs gefunden." };
  }
  if (urls.length > 50) {
    return { error: "Maximal 50 URLs pro Batch." };
  }

  const results: ImportOne[] = [];
  for (const u of urls) {
    results.push(await importSingleUrl(u, channel, supabase));
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "url_import_batch",
    payload: {
      channel,
      total: urls.length,
      ok: okCount,
      fail: failCount,
    },
  });

  revalidatePath("/library/sources");
  return { ok: true, total: urls.length, okCount, failCount, results };
}

// =====================================================================
// Row-level actions
// =====================================================================
// =====================================================================
// Bulk actions — delete / feature multiple at once
// =====================================================================

export async function bulkDeleteSourcePosts(ids: string[]) {
  const { supabase, user, profile } = await requireUser();
  if (profile.role !== "admin") {
    return { error: "Nur Admin darf löschen." };
  }
  if (!ids.length) return { ok: true, deleted: 0 };
  if (ids.length > 500) return { error: "Zu viele Einträge auf einmal." };

  const { error, count } = await supabase
    .from("source_posts")
    .delete({ count: "exact" })
    .in("id", ids);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "source_posts_bulk_delete",
    payload: { count: count ?? ids.length },
  });

  revalidatePath("/library/sources");
  return { ok: true, deleted: count ?? ids.length };
}

export async function bulkSetFeatured(ids: string[], featured: boolean) {
  const { supabase, user, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor." };
  }
  if (!ids.length) return { ok: true, updated: 0 };
  if (ids.length > 500) return { error: "Zu viele Einträge auf einmal." };

  const { error, count } = await supabase
    .from("source_posts")
    .update({ is_featured: featured }, { count: "exact" })
    .in("id", ids);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: featured
      ? "source_posts_bulk_featured"
      : "source_posts_bulk_unfeatured",
    payload: { count: count ?? ids.length },
  });

  revalidatePath("/library/sources");
  return { ok: true, updated: count ?? ids.length };
}

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

/**
 * Mini-Readability: extract the article body from raw HTML.
 *
 * Order of tries:
 *  1. <article>…</article> — modern sites
 *  2. <main>…</main> — HTML5 semantic sites
 *  3. [itemprop="articleBody"] — schema.org tagged sites
 *  4. .post-content / .entry-content / .article-content — WP classic
 *  5. Fall back to the whole body with chrome (nav/header/footer/aside) stripped
 *
 * This is MUCH better than stripping tags from the entire HTML doc,
 * which on modern sites pulls in menu + footer + cookie banner text
 * but often misses the actual article because the article text was
 * already drowned out by boilerplate. The new approach picks the
 * main container first, then strips.
 */
function extractArticleBody(html: string): string {
  // First: remove scripts/styles/noscript from the whole doc so the
  // inner extracted container doesn't carry inline JS text
  const cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "");

  // Try known containers in order. The regex is non-greedy on the
  // inner content so nested tags still close correctly.
  const containers: RegExp[] = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<[^>]+itemprop=["']articleBody["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    /<div\b[^>]*class=["'][^"']*(?:post-content|entry-content|article-content|article__body|post__content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const re of containers) {
    const m = cleaned.match(re);
    if (m?.[1]) {
      const inner = m[1];
      const text = stripTagsKeepText(inner);
      if (text.length > 300) return text; // good signal
    }
  }

  // Fallback: strip boilerplate chrome from the full doc, then
  // extract text. This keeps navigation text out of the body.
  const withoutChrome = cleaned
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, "")
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, "");

  return stripTagsKeepText(withoutChrome);
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
