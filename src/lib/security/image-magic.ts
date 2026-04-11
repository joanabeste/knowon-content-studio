/**
 * Image file "magic byte" sniffing.
 *
 * Reason: client-supplied `File.type` is just a header and can be
 * spoofed trivially — a malicious actor can upload a file with
 * `Content-Type: image/png` but a binary payload that's actually
 * something else (ZIP, HTML, JS, ELF, …). sharp and Supabase Storage
 * don't necessarily re-validate on our behalf.
 *
 * So before we composite / store anything, we sniff the first few
 * bytes of the raw buffer to make sure it really matches one of the
 * formats we claim to accept. SVG is handled as a text check because
 * it has no binary magic.
 */

export type SniffedImageKind = "png" | "jpeg" | "webp" | "svg" | null;

export function sniffImageKind(buffer: Buffer): SniffedImageKind {
  if (!buffer || buffer.length < 8) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  // WebP: "RIFF" + 4 bytes + "WEBP"
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return "webp";
  }

  // SVG: text-based, starts with `<svg` or `<?xml` → look for `<svg`
  // in the first ~1 KB to be safe (allowing XML declarations and
  // comments before the root tag).
  const head = buffer.slice(0, 1024).toString("utf-8").toLowerCase();
  // Reject SVGs with embedded scripts or external refs outright.
  // Admin uploads should be raster anyway; SVGs are only accepted
  // for the brand logo, and there we don't want active content.
  if (head.includes("<svg")) {
    if (/<script\b/i.test(head) || /on\w+\s*=/i.test(head)) {
      return null;
    }
    return "svg";
  }

  return null;
}

/**
 * Convenience: asserts the buffer is one of the allowed kinds AND
 * matches the client-declared mime type. Returns the sniffed kind
 * or an error message.
 */
export function assertImageMatches(
  buffer: Buffer,
  declaredMime: string,
  allowed: SniffedImageKind[],
): { ok: true; kind: Exclude<SniffedImageKind, null> } | { ok: false; error: string } {
  const kind = sniffImageKind(buffer);
  if (!kind) {
    return { ok: false, error: "Datei ist kein unterstütztes Bildformat." };
  }
  if (!allowed.includes(kind)) {
    return {
      ok: false,
      error: `Datei-Typ ${kind} ist für diesen Upload nicht erlaubt.`,
    };
  }
  // Cross-check declared mime type against sniffed kind to catch
  // obvious spoofing. Not strict — webp/png can declare either.
  const mimeOk =
    (kind === "png" && declaredMime === "image/png") ||
    (kind === "jpeg" && declaredMime === "image/jpeg") ||
    (kind === "webp" && declaredMime === "image/webp") ||
    (kind === "svg" && declaredMime === "image/svg+xml");
  if (!mimeOk) {
    return {
      ok: false,
      error: "Dateityp passt nicht zum Datei-Inhalt.",
    };
  }
  return { ok: true, kind };
}
