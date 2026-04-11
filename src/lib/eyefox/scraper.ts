/**
 * Eyefox partner-page scraper.
 *
 * Eyefox has no public API, so we fetch the partner page HTML and
 * extract news items via a best-effort regex-based parser. Fragile
 * against layout changes, but adequate for the current KnowOn profile
 * at https://www.eyefox.com/partner/3695/knowon-gmbh.
 */

export interface EyefoxItem {
  externalId: string;
  title: string;
  body: string;
  url?: string;
  publishedAt?: string | null;
}

export async function scrapeEyefoxPartnerPage(
  partnerUrl: string,
): Promise<EyefoxItem[]> {
  const res = await fetch(partnerUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; KnowOnContentStudio/1.0; +https://www.knowon.de)",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Eyefox fetch failed: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();

  return extractItems(html, partnerUrl);
}

/**
 * Pragmatic extraction:
 * 1. Strip scripts/styles
 * 2. Find all <article> / class~=news|post|card blocks
 * 3. Within each, pull headline (h2/h3/h4) + text body
 * 4. Fallback: chunk paragraphs > 150 chars
 */
export function extractItems(html: string, baseUrl: string): EyefoxItem[] {
  const clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "");

  // Primary pass: look for article-like blocks
  const blockRegex =
    /<(article|div|section)\b[^>]*class=["'][^"']*(news|post|card|beitrag|artikel|message|mitteilung|announcement)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
  const items: EyefoxItem[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(clean))) {
    const inner = match[3];
    const title = extractHeading(inner);
    const body = stripTagsCollapse(inner);
    if (!title && body.length < 200) continue;
    const key = (title || "") + body.slice(0, 100);
    if (seen.has(key)) continue;
    seen.add(key);
    const url = extractFirstHref(inner, baseUrl);
    const publishedAt = extractDate(inner);
    items.push({
      externalId: hashId(key),
      title: title ?? body.slice(0, 80),
      body: body.slice(0, 4000),
      url: url ?? undefined,
      publishedAt: publishedAt ?? null,
    });
  }

  if (items.length > 0) return items;

  // Fallback: substantial paragraphs
  const paraRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let pm: RegExpExecArray | null;
  const seenFallback = new Set<string>();
  while ((pm = paraRegex.exec(clean))) {
    const text = stripTagsCollapse(pm[1]);
    if (text.length < 150) continue;
    const key = text.slice(0, 150);
    if (seenFallback.has(key)) continue;
    seenFallback.add(key);
    items.push({
      externalId: hashId(key),
      title: text.slice(0, 80),
      body: text.slice(0, 4000),
      publishedAt: null,
    });
  }

  return items;
}

function extractHeading(html: string): string | null {
  const m = html.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
  if (!m) return null;
  return stripTagsCollapse(m[1]) || null;
}

function extractFirstHref(html: string, baseUrl: string): string | null {
  const m = html.match(/<a[^>]+href=["']([^"']+)["']/i);
  if (!m?.[1]) return null;
  try {
    return new URL(m[1], baseUrl).toString();
  } catch {
    return null;
  }
}

function extractDate(html: string): string | null {
  // Look for ISO-ish dates or German DD.MM.YYYY
  const iso = html.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso?.[1]) return new Date(iso[1]).toISOString();
  const de = html.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
  if (de) {
    const [, d, m, y] = de;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return new Date(iso).toISOString();
  }
  return null;
}

function stripTagsCollapse(html: string): string {
  return html
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

function hashId(input: string): string {
  // Cheap deterministic hash (not cryptographic — only for dedupe)
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return `eyefox_${Math.abs(h).toString(36)}`;
}
