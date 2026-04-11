"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  loadLinkedinConnection,
  disconnectLinkedin,
} from "@/lib/linkedin/connection";
import { fetchOwnPosts } from "@/lib/linkedin/client";

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

  // Existing example titles (dedupe)
  const { data: existing } = await supabase
    .from("golden_examples")
    .select("note")
    .eq("channel", "linkedin");
  const existingIds = new Set(
    (existing ?? [])
      .map((e) => e.note)
      .filter(Boolean)
      .map((n) => (n as string).match(/LinkedIn-ID: (\S+)/)?.[1])
      .filter(Boolean),
  );

  const rows = posts
    .filter((p) => p.commentary && !existingIds.has(p.id))
    .map((p) => ({
      channel: "linkedin" as const,
      title: (p.commentary ?? "").slice(0, 80),
      body: p.commentary ?? "",
      note: `LinkedIn-ID: ${p.id}`,
      created_by: user.id,
    }));

  if (rows.length) {
    const { error } = await supabase.from("golden_examples").insert(rows);
    if (error) return { error: error.message };
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "linkedin_sync",
    payload: { fetched: posts.length, imported: rows.length },
  });

  revalidatePath("/library/examples");
  revalidatePath("/settings/integrations");
  return { ok: true, fetched: posts.length, imported: rows.length };
}
