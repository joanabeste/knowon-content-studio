/**
 * Tiny typed helpers for reading FormData in Server Actions.
 *
 * Server Actions receive raw FormData where every field is `File |
 * string | null`. Throughout the app we kept writing
 * `String(formData.get("x") || "").trim()`, which is verbose, hides
 * the empty-vs-missing distinction, and silently falls back to `""`
 * when a File was uploaded. These helpers do the same job more
 * explicitly.
 *
 * Call-site behaviour:
 *   getFormString(fd, "topic")      → "foo" | null  (null when missing or blank)
 *   getFormStrings(fd, "channels")  → string[]     (multi-value fields)
 *   getFormNumber(fd, "port")       → number | null
 *   getFormBool(fd, "secure")       → true | false (checkbox idiom)
 */

/** Read a single string field, trim it, return `null` if blank/missing. */
export function getFormString(fd: FormData, key: string): string | null {
  const raw = fd.get(key);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Read all values of a multi-value field (e.g. repeated checkboxes
 * or <select multiple>). Non-string entries (File blobs) are
 * skipped, blanks are dropped.
 */
export function getFormStrings(fd: FormData, key: string): string[] {
  return fd
    .getAll(key)
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v !== "");
}

/** Parse a numeric field; returns null on empty/missing/unparseable. */
export function getFormNumber(fd: FormData, key: string): number | null {
  const s = getFormString(fd, key);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * HTML checkboxes post "on" when checked and nothing when unchecked,
 * so presence = true. Works the same for `<input type="hidden" value="1">`
 * toggles.
 */
export function getFormBool(fd: FormData, key: string): boolean {
  const raw = fd.get(key);
  if (typeof raw !== "string") return false;
  const v = raw.trim().toLowerCase();
  return v === "on" || v === "true" || v === "1" || v === "yes";
}
