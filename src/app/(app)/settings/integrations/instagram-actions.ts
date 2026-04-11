"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  loadInstagramConnection,
  disconnectInstagram,
} from "@/lib/instagram/connection";
import { fetchInstagramMedia } from "@/lib/instagram/client";

export async function disconnectInstagramAction() {
  await requireRole("admin");
  await disconnectInstagram();
  revalidatePath("/settings/integrations");
  return { ok: true };
}

export async function syncInstagramMedia() {
  const { supabase, user } = await requireRole("admin");

  const conn = await loadInstagramConnection();
  if (!conn) {
    return { error: "Instagram ist nicht verbunden." };
  }

  let media;
  try {
    media = await fetchInstagramMedia(conn.accessToken, conn.igUserId, 20);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Instagram-Abruf fehlgeschlagen: ${msg}` };
  }

  // Dedupe by IG ID stored in note
  const { data: existing } = await supabase
    .from("golden_examples")
    .select("note")
    .eq("channel", "instagram");
  const existingIds = new Set(
    (existing ?? [])
      .map((e) => e.note)
      .filter(Boolean)
      .map((n) => (n as string).match(/Instagram-ID: (\S+)/)?.[1])
      .filter(Boolean),
  );

  const rows = media
    .filter((m) => m.caption && !existingIds.has(m.id))
    .map((m) => ({
      channel: "instagram" as const,
      title: (m.caption ?? "").slice(0, 80),
      body: m.caption ?? "",
      note: `Instagram-ID: ${m.id}${m.permalink ? ` · ${m.permalink}` : ""}`,
      created_by: user.id,
    }));

  if (rows.length) {
    const { error } = await supabase.from("golden_examples").insert(rows);
    if (error) return { error: error.message };
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "instagram_sync",
    payload: { fetched: media.length, imported: rows.length },
  });

  revalidatePath("/library/examples");
  revalidatePath("/settings/integrations");
  return { ok: true, fetched: media.length, imported: rows.length };
}
