/**
 * URL validation for user-supplied URLs that the server will fetch.
 *
 * Purpose: prevent Server-Side Request Forgery (SSRF) — an
 * authenticated team member should NOT be able to make the Vercel
 * runtime fetch internal IP ranges (AWS metadata at 169.254.169.254,
 * private ranges, localhost). Doing so could leak environment secrets
 * or reach internal-only services.
 *
 * Scope: this is a best-effort *syntactic* check against well-known
 * internal/reserved ranges. It does NOT do DNS resolution, so a
 * malicious hostname that resolves to an internal IP via DNS rebinding
 * will slip through. For a ~5-user internal tool we accept this
 * trade-off — the main attacker in our threat model is a team member
 * being sloppy with URLs, not a motivated adversary.
 *
 * Usage:
 *   const guard = assertPublicHttpUrl(rawUrl);
 *   if (!guard.ok) return { error: guard.error };
 *   // use guard.url (a URL object) from here
 */

/**
 * Hostnames and prefixes we refuse to fetch. Kept as a flat list
 * because regex is more compact and fast enough here.
 */
const BLOCKED_HOST_PATTERNS: RegExp[] = [
  // Localhost + loopback
  /^localhost$/i,
  /^127\./,
  /^::1$/,
  /^0\.0\.0\.0$/,
  // Link-local (AWS/GCP/Azure metadata endpoint lives here)
  /^169\.254\./,
  /^fe80:/i,
  // Private IPv4 ranges (RFC1918)
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  // Unique local IPv6
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  // Internal TLDs / suffixes
  /\.internal$/i,
  /\.local$/i,
  /\.lan$/i,
  /\.intranet$/i,
];

export type UrlGuardResult =
  | { ok: true; url: URL }
  | { ok: false; error: string };

export function assertPublicHttpUrl(raw: string): UrlGuardResult {
  if (!raw || typeof raw !== "string") {
    return { ok: false, error: "URL ist leer." };
  }

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Ungültige URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      ok: false,
      error: "Nur http(s)-URLs sind erlaubt.",
    };
  }

  const host = url.hostname.toLowerCase();
  if (!host) {
    return { ok: false, error: "URL ohne Host." };
  }

  for (const re of BLOCKED_HOST_PATTERNS) {
    if (re.test(host)) {
      return {
        ok: false,
        error: "Diese URL zeigt auf eine interne Adresse und wird blockiert.",
      };
    }
  }

  return { ok: true, url };
}
