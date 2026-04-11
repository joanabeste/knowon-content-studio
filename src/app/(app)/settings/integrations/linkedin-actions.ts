"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  loadLinkedinConnection,
  disconnectLinkedin,
} from "@/lib/linkedin/connection";
import { fetchOwnPosts } from "@/lib/linkedin/client";
import type { SourcePostSource } from "@/lib/supabase/types";

export async function disconnectLinkedinAction() {
  await requireRole("admin");
  await disconnectLinkedin();
  revalidatePath("/settings/integrations");
  return { ok: true };
}

export async function syncLinkedinPosts() {
  const { supabase, user } = await requireRole("admin");

  const conn = await loadLinkedinConnection();
  if (!conn) {
    return { error: "LinkedIn ist nicht verbunden." };
  }

  let posts;
  try {
    posts = await fetchOwnPosts(conn.accessToken, conn.externalId, 20);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `LinkedIn-Abruf fehlgeschlagen: ${msg}` };
  }

  const rows = posts
    .filter((p) => p.commentary)
    .map((p) => ({
      source: "linkedin" as SourcePostSource,
      external_id: p.id,
      url: null,
      title: (p.commentary ?? "").split("\n")[0]?.slice(0, 120) || null,
      body: p.commentary ?? "",
      published_at: p.createdAt
        ? new Date(p.createdAt).toISOString()
        : null,
      imported_at: new Date().toISOString(),
      channel: "linkedin" as const,
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
    action: "linkedin_sync",
    payload: { fetched: posts.length, imported: rows.length },
  });

  revalidatePath("/library/sources");
  revalidatePath("/settings/integrations");
  return { ok: true, fetched: posts.length, imported: rows.length };
}
