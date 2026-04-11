import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { doSyncFeed } from "@/app/(app)/library/feeds/actions";

/**
 * Vercel Cron endpoint — fetches all active feeds.
 *
 * Invocation: Vercel calls this URL per the schedule in vercel.json.
 * Security: Vercel adds an `Authorization: Bearer <CRON_SECRET>` header
 * automatically when the env var CRON_SECRET is set. We require the
 * env var AND a matching header — if CRON_SECRET is unset the
 * endpoint is hard-closed (fail-closed), otherwise the endpoint would
 * be a free public trigger for OpenAI costs and bandwidth.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(
      "[cron/sync-feeds] CRON_SECRET env var is not set — refusing to run",
    );
    return new NextResponse("Misconfigured", { status: 500 });
  }
  const header = req.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: feeds, error } = await admin
    .from("content_feeds")
    .select("id, name")
    .eq("is_active", true);

  if (error) {
    return NextResponse.json(
      { error: `DB fetch failed: ${error.message}` },
      { status: 500 },
    );
  }

  if (!feeds?.length) {
    return NextResponse.json({ ok: true, synced: 0, message: "No feeds" });
  }

  const results = [];
  for (const f of feeds) {
    const r = await doSyncFeed(f.id, admin, null);
    results.push({
      feed: f.name,
      ...r,
    });
  }

  const okCount = results.filter((r) => "ok" in r && r.ok).length;
  const errCount = results.filter((r) => "error" in r).length;

  return NextResponse.json({
    ok: true,
    synced: okCount,
    errors: errCount,
    results,
  });
}
