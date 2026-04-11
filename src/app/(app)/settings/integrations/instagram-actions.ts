"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  loadInstagramConnection,
  disconnectInstagram,
} from "@/lib/instagram/connection";
import { fetchInstagramMedia } from "@/lib/instagram/client";
import type { SourcePostSource } from "@/lib/supabase/types";

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

  const rows = media
    .filter((m) => m.caption)
    .map((m) => ({
      source: "instagram" as SourcePostSource,
      external_id: m.id,
      url: m.permalink ?? null,
      title: (m.caption ?? "").split("\n")[0]?.slice(0, 120) || null,
      body: m.caption ?? "",
      published_at: m.timestamp
        ? new Date(m.timestamp).toISOString()
        : null,
      imported_at: new Date().toISOString(),
      channel: "instagram" as const,
      is_featured: false,
    }));

  if (rows.length) {
    const { error } = await supabase
      .from("source_posts")
      .upsert(rows, { onConflict: "source,external_id" });
    if (error) return { error: error.message };
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "instagram_sync",
    payload: { fetched: media.length, imported: rows.length },
  });

  revalidatePath("/library/sources");
  revalidatePath("/settings/integrations");
  return { ok: true, fetched: media.length, imported: rows.length };
}
