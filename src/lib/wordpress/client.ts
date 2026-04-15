/**
 * Minimal WordPress REST API client — fetches public posts from knowon.de
 * (no auth needed for reading published content).
 */

import { assertPublicHttpUrl } from "@/lib/security/url-guard";

/**
 * Guard every outbound WordPress fetch against SSRF: even though the
 * base URL comes from an admin-configured integration, a misconfigured
 * or maliciously-edited value (`http://169.254.169.254`, `localhost`,
 * internal TLD) would otherwise let the server probe internal
 * metadata endpoints. Throws so the caller's try/catch surfaces a
 * clear error instead of silently fetching.
 */
function assertWpBase(baseUrl: string): void {
  const guard = assertPublicHttpUrl(baseUrl);
  if (!guard.ok) {
    throw new Error(`WordPress-Basis-URL blockiert: ${guard.error}`);
  }
}

export interface WpPost {
  id: number;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  date_gmt: string;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchWordpressPosts(
  baseUrl: string,
  limit = 20,
): Promise<WpPost[]> {
  assertWpBase(baseUrl);
  const url = new URL("/wp-json/wp/v2/posts", baseUrl);
  url.searchParams.set("per_page", String(Math.min(limit, 100)));
  url.searchParams.set(
    "_fields",
    "id,link,title,excerpt,content,date_gmt",
  );

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    // No caching — we want fresh data each sync
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`WP API failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as WpPost[];
}

// =====================================================================
// Authenticated Publishing (uses WP Application Password via Basic Auth)
// =====================================================================

export interface WpCredentials {
  baseUrl: string;
  username: string;
  applicationPassword: string;
}

function authHeader(creds: WpCredentials): string {
  const token = Buffer.from(
    `${creds.username}:${creds.applicationPassword}`,
  ).toString("base64");
  return `Basic ${token}`;
}

export interface WpMedia {
  id: number;
  source_url: string;
  title: { rendered: string };
}

/** Uploads a PNG/JPG buffer to WordPress media library. */
export async function uploadMedia(
  creds: WpCredentials,
  fileName: string,
  buffer: Buffer,
  contentType: "image/png" | "image/jpeg" = "image/png",
): Promise<WpMedia> {
  assertWpBase(creds.baseUrl);
  const url = new URL("/wp-json/wp/v2/media", creds.baseUrl);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: authHeader(creds),
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
    body: buffer as unknown as BodyInit,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WP media upload failed: ${res.status} ${text}`);
  }
  return (await res.json()) as WpMedia;
}

export interface WpCreatePostInput {
  title: string;
  content: string;
  excerpt?: string;
  slug?: string;
  featuredMediaId?: number;
  tagNames?: string[];
  categoryNames?: string[];
  metaDescription?: string;
  /**
   * - `draft`   (default) → private Entwurfsfassung, nichts geht live
   * - `future`  → wird zum `date` automatisch veröffentlicht (Schedule)
   * - `publish` → sofort live
   * - `pending` → zur Freigabe
   */
  status?: "draft" | "publish" | "pending" | "future";
  /**
   * ISO-8601 date string. Sets the post's publication date.
   * - Zusammen mit `status: "future"` plant WordPress die
   *   Veröffentlichung automatisch zu diesem Zeitpunkt
   * - Mit `status: "draft"` gibt es dem Draft ein bestimmtes Datum,
   *   wird aber nicht automatisch veröffentlicht
   */
  date?: string;
}

export interface WpPostResult {
  id: number;
  link: string;
  status: string;
}

/**
 * Ensures terms (tags or categories) exist for the given taxonomy,
 * returning their numeric IDs. Missing terms are created on the fly.
 */
async function ensureTerms(
  creds: WpCredentials,
  taxonomy: "tags" | "categories",
  names: string[],
): Promise<number[]> {
  if (!names.length) return [];
  const ids: number[] = [];
  for (const name of names) {
    // Search for existing
    const search = new URL(`/wp-json/wp/v2/${taxonomy}`, creds.baseUrl);
    search.searchParams.set("search", name);
    search.searchParams.set("per_page", "10");
    const sres = await fetch(search.toString(), {
      headers: { Authorization: authHeader(creds) },
      cache: "no-store",
    });
    if (sres.ok) {
      const found = (await sres.json()) as { id: number; name: string }[];
      const exact = found.find(
        (t) => t.name.toLowerCase() === name.toLowerCase(),
      );
      if (exact) {
        ids.push(exact.id);
        continue;
      }
    }
    // Create new
    const cres = await fetch(
      new URL(`/wp-json/wp/v2/${taxonomy}`, creds.baseUrl).toString(),
      {
        method: "POST",
        headers: {
          Authorization: authHeader(creds),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      },
    );
    if (cres.ok) {
      const created = (await cres.json()) as { id: number };
      ids.push(created.id);
    }
  }
  return ids;
}

const ensureTags = (creds: WpCredentials, names: string[]) =>
  ensureTerms(creds, "tags", names);

const ensureCategories = (creds: WpCredentials, names: string[]) =>
  ensureTerms(creds, "categories", names);

/**
 * Lists category names from the connected WordPress site. Used by the
 * variant editor's quick-pick UI and by the generation prompt so GPT
 * can suggest categories that already exist (avoids category-sprawl).
 *
 * Returns `[]` on any error — the caller decides what "no categories"
 * means, and we never want generation or editing to fail because of
 * a flaky WP connection.
 */
export async function fetchWordpressCategoryNames(
  creds: WpCredentials,
  limit = 100,
): Promise<string[]> {
  try {
    assertWpBase(creds.baseUrl);
    const url = new URL("/wp-json/wp/v2/categories", creds.baseUrl);
    url.searchParams.set("per_page", String(Math.min(limit, 100)));
    url.searchParams.set("orderby", "count");
    url.searchParams.set("order", "desc");
    url.searchParams.set("_fields", "id,name,count");
    const res = await fetch(url.toString(), {
      headers: { Authorization: authHeader(creds) },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { name: string }[];
    return data.map((c) => c.name).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Creates a new post OR updates an existing one. WordPress uses the
 * same endpoint and method (POST) for both — the difference is whether
 * the URL includes the post ID.
 */
async function sendPost(
  creds: WpCredentials,
  input: WpCreatePostInput,
  existingPostId?: number,
): Promise<WpPostResult> {
  assertWpBase(creds.baseUrl);
  const tagIds = input.tagNames ? await ensureTags(creds, input.tagNames) : [];
  const categoryIds = input.categoryNames
    ? await ensureCategories(creds, input.categoryNames)
    : [];

  const body: Record<string, unknown> = {
    status: input.status ?? "draft",
    title: input.title,
    content: input.content,
  };
  if (input.excerpt) body.excerpt = input.excerpt;
  if (input.slug) body.slug = input.slug;
  if (input.featuredMediaId) body.featured_media = input.featuredMediaId;
  if (tagIds.length) body.tags = tagIds;
  if (categoryIds.length) body.categories = categoryIds;
  if (input.date) {
    body.date = input.date;
    body.date_gmt = input.date;
  }
  if (input.metaDescription) {
    body.meta = {
      _yoast_wpseo_metadesc: input.metaDescription,
      rank_math_description: input.metaDescription,
    };
  }

  const path = existingPostId
    ? `/wp-json/wp/v2/posts/${existingPostId}`
    : `/wp-json/wp/v2/posts`;

  const res = await fetch(new URL(path, creds.baseUrl).toString(), {
    method: "POST",
    headers: {
      Authorization: authHeader(creds),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `WP post ${existingPostId ? "update" : "create"} failed: ${res.status} ${text}`,
    );
  }
  return (await res.json()) as WpPostResult;
}

export async function createPost(
  creds: WpCredentials,
  input: WpCreatePostInput,
): Promise<WpPostResult> {
  return sendPost(creds, input);
}

export async function updatePost(
  creds: WpCredentials,
  postId: number,
  input: WpCreatePostInput,
): Promise<WpPostResult> {
  return sendPost(creds, input, postId);
}

/** Verifies that credentials work by calling /users/me. */
export async function verifyCredentials(
  creds: WpCredentials,
): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    assertWpBase(creds.baseUrl);
    const res = await fetch(
      new URL("/wp-json/wp/v2/users/me", creds.baseUrl).toString(),
      {
        headers: { Authorization: authHeader(creds) },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `${res.status} ${text}` };
    }
    const data = (await res.json()) as { name?: string };
    return { ok: true, name: data.name };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
