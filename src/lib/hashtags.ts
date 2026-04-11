/**
 * Shared hashtag helpers.
 *
 * GPT sometimes returns hashtag strings with one or more leading
 * `#` characters, even though the JSON schema says "plain word".
 * We strip those defensively in three places: once at generation
 * time when the LLM output is mapped into variant metadata, once
 * at render time in the variant card (so historic rows that still
 * carry the `#` prefix display correctly without requiring a
 * re-generate), and once in the copy-to-clipboard path. Having
 * one shared util means the three call sites can't drift apart.
 */

/** Strip any leading `#` chars + whitespace from a single tag. */
export function normalizeHashtag(raw: string): string {
  return raw.replace(/^#+/, "").trim();
}

/**
 * Normalize + drop empty entries from an array of hashtag strings.
 * Used both when ingesting GPT output and when rendering stored
 * values, so the two stay consistent.
 */
export function cleanHashtags(tags: string[] | null | undefined): string[] {
  if (!tags) return [];
  return tags.map(normalizeHashtag).filter(Boolean);
}
