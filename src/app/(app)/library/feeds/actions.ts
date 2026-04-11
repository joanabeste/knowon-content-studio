"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole, requireUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { fetchAndParseFeed } from "@/lib/rss/parser";
import { assertPublicHttpUrl } from "@/lib/security/url-guard";
import type { Channel, ContentFeed, SourcePostSource } from "@/lib/supabase/types";

/**
 * Both a cookie-bound user client and the service-role admin client
 * are passed into `doSyncFeed`, so we use the loosest Supabase
 * client type that both share. The actions within only touch a few
 * tables and stay away from schema-specific generics.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FeedSyncClient = SupabaseClient<any, "public", any>;

const VALID_CHANNELS: Channel[] = [
  "linkedin",
  "instagram",
  "eyefox",
  "newsletter",
  "blog",
];

export async function addFeed(formData: FormData) {
  const { supabase, user } = await requireRole("admin");

  const name = String(formData.get("name") || "").trim();
  const url = String(formData.get("url") || "").trim();
  const channel = String(formData.get("channel") || "") as Channel;

  if (!name) return { error: "Name ist erforderlich." };
  const guard = assertPublicHttpUrl(url);
  if (!guard.ok) return { error: guard.error };
  if (!VALID_CHANNELS.includes(channel))
    return { error: "Ungültiger Kanal." };

  const { error } = await supabase.from("content_feeds").insert({
    name,
    url,
    channel,
    is_active: true,
    created_by: user.id,
  });
  if (error) {
    if (error.message.includes("duplicate"))
      return { error: "Diese URL ist bereits als Feed hinterlegt." };
    return { error: error.message };
  }

  revalidatePath("/library/feeds");
  revalidatePath("/settings/integrations");
  return { ok: true };
}

export async function deleteFeed(feedId: string) {
  await requireRole("admin");
  const { supabase } = await requireUser();
  const { error } = await supabase.from("content_feeds").delete().eq("id", feedId);
  if (error) return { error: error.message };
  revalidatePath("/library/feeds");
  revalidatePath("/settings/integrations");
  return { ok: true };
}

export async function toggleFeedActive(feedId: string) {
  const { supabase } = await requireRole("admin");
  const { data: current } = await supabase
    .from("content_feeds")
    .select("is_active")
    .eq("id", feedId)
    .single();
  if (!current) return { error: "Feed nicht gefunden." };
  const { error } = await supabase
    .from("content_feeds")
    .update({
      is_active: !current.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", feedId);
  if (error) return { error: error.message };
  revalidatePath("/library/feeds");
  revalidatePath("/settings/integrations");
  return { ok: true };
}

/**
 * Syncs a single feed: fetches, parses, upserts items into source_posts.
 * Returns counts for UI feedback.
 */
export async function syncFeed(feedId: string) {
  const { supabase, user } = await requireRole("admin");
  return doSyncFeed(feedId, supabase, user.id);
}

/**
 * Internal: does the actual work. Extracted so the cron endpoint can
 * reuse it without the role check (cron uses service role directly).
 */
export async function doSyncFeed(
  feedId: string,
  client: FeedSyncClient,
  actorId: string | null,
): Promise<
  | { error: string }
  | { ok: true; feedName: string; fetched: number; imported: number }
> {
  const { data: feedRow, error: feedErr } = await client
    .from("content_feeds")
    .select("*")
    .eq("id", feedId)
    .single();
  if (feedErr || !feedRow) return { error: "Feed nicht gefunden." };
  const feed = feedRow as ContentFeed;

  let items;
  try {
    items = await fetchAndParseFeed(feed.url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await client
      .from("content_feeds")
      .update({
        last_error: msg,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", feedId);
    return { error: `Feed-Abruf fehlgeschlagen: ${msg}` };
  }

  // Upsert each item as a source_post
  const rows = items.map((item) => ({
    source: "url_import" as SourcePostSource,
    external_id: `feed_${feed.id}_${item.guid}`,
    url: item.link,
    title: item.title,
    body: item.content || item.title,
    published_at: item.publishedAt,
    imported_at: new Date().toISOString(),
    channel: feed.channel,
    is_featured: false,
  }));

  let imported = 0;
  if (rows.length) {
    const { error: upErr, count } = await client
      .from("source_posts")
      .upsert(rows, { onConflict: "source,external_id", count: "exact" });
    if (upErr) {
      await client
        .from("content_feeds")
        .update({
          last_error: upErr.message,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", feedId);
      return { error: `DB-Upsert fehlgeschlagen: ${upErr.message}` };
    }
    imported = count ?? rows.length;
  }

  await client
    .from("content_feeds")
    .update({
      last_synced_at: new Date().toISOString(),
      last_error: null,
      items_count: rows.length,
    })
    .eq("id", feedId);

  if (actorId) {
    await client.from("audit_log").insert({
      actor: actorId,
      action: "feed_sync",
      target_type: "content_feed",
      target_id: feedId,
      payload: { feed_name: feed.name, fetched: items.length, imported },
    });
  }

  revalidatePath("/library/feeds");
  revalidatePath("/library/sources");
  revalidatePath("/settings/integrations");

  return { ok: true, feedName: feed.name, fetched: items.length, imported };
}

/** Sync all active feeds. Used by cron + manual "sync all" button. */
export async function syncAllFeeds() {
  const { user } = await requireRole("admin");
  const admin = getSupabaseAdmin();
  const { data: feeds } = await admin
    .from("content_feeds")
    .select("id")
    .eq("is_active", true);
  if (!feeds?.length) return { ok: true, results: [] };

  const results = [];
  for (const f of feeds) {
    const r = await doSyncFeed(f.id, admin, user.id);
    results.push(r);
  }
  revalidatePath("/library/feeds");
  revalidatePath("/library/sources");
  revalidatePath("/settings/integrations");
  return { ok: true, results };
}
