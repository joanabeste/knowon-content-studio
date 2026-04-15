"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

const MAX_CONTENT_LEN = 200_000; // ~200KB
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Parses a PDF file and returns its extracted text.
 * Client uploads the raw PDF via FormData, server parses and returns
 * plain text. Uses pdf-parse (pure JS, no native deps).
 */
export async function parsePdfFile(
  formData: FormData,
): Promise<{ title: string; content: string } | { error: string }> {
  await requireUser(); // must be logged in at least

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Keine Datei übergeben." };
  }
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return { error: "Nur PDF-Dateien werden hier akzeptiert." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return {
      error: `Datei zu groß (${Math.round(file.size / 1024 / 1024)} MB, max 10 MB).`,
    };
  }

  let text: string;
  try {
    // Dynamic import so pdf-parse isn't bundled on the client.
    // @types/pdf-parse exports the function as default; CJS interop via
    // `as unknown` so both runtime shapes work.
    const mod = await import("pdf-parse");
    const pdfParse = (mod as unknown as {
      default: (b: Buffer) => Promise<{ text: string }>;
    }).default;
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await pdfParse(buf);
    text = result.text ?? "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `PDF-Parsing fehlgeschlagen: ${msg}` };
  }

  // Normalize whitespace
  text = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) {
    return {
      error:
        "Keinen Text im PDF gefunden. Möglicherweise ist es ein Scan ohne OCR.",
    };
  }

  if (text.length > MAX_CONTENT_LEN) {
    text = text.slice(0, MAX_CONTENT_LEN) + "\n\n[…gekürzt wegen Limit]";
  }

  const defaultTitle = file.name.replace(/\.pdf$/i, "");
  return { title: defaultTitle, content: text };
}

export async function addDocument(formData: FormData) {
  const { supabase, user, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor." };
  }

  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "");
  const fileName = String(formData.get("file_name") || "").trim() || null;
  const source = fileName ? "upload" : "manual";
  const tagsRaw = String(formData.get("tags") || "");
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!title) return { error: "Titel fehlt." };
  if (!content.trim()) return { error: "Inhalt fehlt." };
  if (content.length > MAX_CONTENT_LEN) {
    return {
      error: `Inhalt zu groß (max. ${Math.round(MAX_CONTENT_LEN / 1000)}k Zeichen).`,
    };
  }

  const { error } = await supabase.from("context_documents").insert({
    title,
    content,
    source,
    file_name: fileName,
    tags,
    is_active: true,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/library/documents");
  return { ok: true };
}

export async function toggleDocumentActive(id: string) {
  const { supabase, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor." };
  }

  const { data: current } = await supabase
    .from("context_documents")
    .select("is_active")
    .eq("id", id)
    .single();
  if (!current) return { error: "Nicht gefunden." };

  const { error } = await supabase
    .from("context_documents")
    .update({
      is_active: !current.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/library/documents");
  return { ok: true };
}

export async function deleteDocument(id: string) {
  const { supabase, profile } = await requireUser();
  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor." };
  }
  const { error } = await supabase.from("context_documents").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/library/documents");
  return { ok: true };
}
