"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

const MAX_CONTENT_LEN = 200_000; // ~200KB

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
  const { supabase } = await requireUser();
  const { error } = await supabase.from("context_documents").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/library/documents");
  return { ok: true };
}
