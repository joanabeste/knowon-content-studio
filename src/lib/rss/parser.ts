/**
 * Minimal RSS 2.0 + Atom parser.
 *
 * No XML-parser dependency — we use tolerant regexes that handle both
 * formats. Good enough for 99% of real feeds (rss.app, WordPress,
 * Medium, Substack, etc.). If a feed uses unusual CDATA nesting or
 * namespaces in weird ways, we'll still pull out the important bits
 * thanks to best-effort matching.
 */

export interface FeedItem {
  guid: string;
  title: string;
  link: string | null;
  content: string;
  publishedAt: string | null;
}

export async function fetchAndParseFeed(url: string): Promise<FeedItem[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; KnowOnContentStudio/1.0; +https://www.knowon.de)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Feed fetch failed: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  return parseFeedXml(xml);
}

export function parseFeedXml(xml: string): FeedItem[] {
  // Detect format: RSS 2.0 uses <item>, Atom uses <entry>
  const isAtom = /<feed\b[^>]*xmlns="http:\/\/www\.w3\.org\/2005\/Atom"/i.test(
    xml,
  ) || /<entry\b/.test(xml) && !/<item\b/.test(xml);

  const items: FeedItem[] = [];
  const tag = isAtom ? "entry" : "item";
  const blockRegex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");

  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(xml))) {
    const inner = match[1];
    const item = parseItemBlock(inner, isAtom);
    if (item) items.push(item);
  }
  return items;
}

function parseItemBlock(inner: string, isAtom: boolean): FeedItem | null {
  const title = decodeText(extractInner(inner, "title") ?? "").trim();
  if (!title) return null;

  // Link
  let link: string | null = null;
  if (isAtom) {
    // <link href="..." rel="alternate" />
    const linkMatch = inner.match(
      /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i,
    );
    link = linkMatch?.[1] ?? null;
  } else {
    link = decodeText(extractInner(inner, "link") ?? "").trim() || null;
  }

  // Content: prefer content:encoded / summary / description
  const content =
    decodeText(
      extractInner(inner, "content:encoded") ??
        extractInner(inner, "content") ??
        extractInner(inner, "description") ??
        extractInner(inner, "summary") ??
        "",
    ).trim();

  // Published date
  const dateRaw =
    extractInner(inner, "pubDate") ??
    extractInner(inner, "published") ??
    extractInner(inner, "updated") ??
    extractInner(inner, "dc:date") ??
    null;
  let publishedAt: string | null = null;
  if (dateRaw) {
    const d = new Date(dateRaw.trim());
    if (!Number.isNaN(d.getTime())) publishedAt = d.toISOString();
  }

  // GUID — prefer guid / id, fall back to link or hash of title
  let guid =
    decodeText(extractInner(inner, "guid") ?? "").trim() ||
    decodeText(extractInner(inner, "id") ?? "").trim() ||
    link ||
    hashString(title);

  // Strip any wrapping whitespace
  guid = guid.trim();

  return {
    guid,
    title,
    link,
    content: stripTags(content),
    publishedAt,
  };
}

function extractInner(xml: string, tagName: string): string | null {
  // Match both <tag>...</tag> and <tag attr="...">...</tag>
  const re = new RegExp(`<${escapeRegex(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegex(tagName)}>`, "i");
  const m = xml.match(re);
  if (!m) return null;
  return unwrapCdata(m[1]);
}

function unwrapCdata(s: string): string {
  const m = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1] : s;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeText(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripTags(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return `hash_${Math.abs(h).toString(36)}`;
}
