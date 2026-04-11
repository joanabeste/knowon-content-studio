import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { doSyncFeed } from "@/app/(app)/library/feeds/actions";

/**
 * Vercel Cron endpoint — fetches all active feeds.
 *
 * Invocation: Vercel calls this URL per the schedule in vercel.json.
 * Security: Vercel adds an `Authorization: Bearer <CRON_SECRET>` header
 * automatically if the env var CRON_SECRET is set. We verify it here
 * so that external calls can't trigger a sync.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await doSyncFeed(f.id, admin as any, null);
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
