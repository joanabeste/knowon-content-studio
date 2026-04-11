"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { fetchWordpressPosts, stripHtml } from "@/lib/wordpress/client";

const DEFAULT_WP_BASE =
  process.env.WORDPRESS_BASE_URL || "https://www.knowon.de";

export async function syncWordpressPosts(options?: {
  baseUrl?: string;
  limit?: number;
  alsoCreateBlogExamples?: boolean;
}) {
  const { supabase, user } = await requireRole("admin");
  const baseUrl = options?.baseUrl || DEFAULT_WP_BASE;
  const limit = options?.limit ?? 20;
  const alsoExamples = options?.alsoCreateBlogExamples ?? true;

  let posts;
  try {
    posts = await fetchWordpressPosts(baseUrl, limit);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `WP fetch fehlgeschlagen: ${msg}` };
  }

  if (!posts.length) return { ok: true, synced: 0, examples: 0 };

  // Upsert into source_posts
  const sourceRows = posts.map((p) => ({
    source: "wordpress" as const,
    external_id: String(p.id),
    url: p.link,
    title: stripHtml(p.title.rendered),
    body: stripHtml(p.content.rendered),
    published_at: p.date_gmt ? new Date(p.date_gmt).toISOString() : null,
    imported_at: new Date().toISOString(),
  }));

  const { error: srcErr } = await supabase
    .from("source_posts")
    .upsert(sourceRows, { onConflict: "source,external_id" });
  if (srcErr) return { error: `source_posts: ${srcErr.message}` };

  // Also create blog golden examples (idempotent via dedupe by title)
  let exampleCount = 0;
  if (alsoExamples) {
    // Fetch existing example titles to avoid duplicates
    const { data: existing } = await supabase
      .from("golden_examples")
      .select("title")
      .eq("channel", "blog");
    const existingTitles = new Set(
      (existing ?? []).map((e) => e.title).filter(Boolean),
    );

    const exampleRows = posts
      .map((p) => ({
        channel: "blog" as const,
        title: stripHtml(p.title.rendered),
        body: stripHtml(p.content.rendered).slice(0, 4000),
        note: `Importiert von ${baseUrl} (ID ${p.id})`,
        created_by: user.id,
      }))
      .filter((ex) => ex.title && !existingTitles.has(ex.title));

    if (exampleRows.length) {
      const { error: exErr } = await supabase
        .from("golden_examples")
        .insert(exampleRows);
      if (!exErr) exampleCount = exampleRows.length;
    }
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "wp_sync",
    target_type: "source_posts",
    payload: {
      base_url: baseUrl,
      synced: posts.length,
      examples_created: exampleCount,
    },
  });

  revalidatePath("/library/sources");
  revalidatePath("/library/examples");
  return { ok: true, synced: posts.length, examples: exampleCount };
}
