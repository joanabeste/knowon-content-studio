#!/usr/bin/env node
/**
 * Dumps all rows from source_posts into a local file for analysis.
 *
 * Usage:
 *   node --env-file=.env.local scripts/dump-sources.mjs
 *
 * Output:
 *   scripts/.sources-dump.json  (gitignored — contains full content)
 *
 * This is a one-shot helper for an analysis task: Joana wants the
 * brand voice rewritten based on the actual inspiration content. I
 * can't talk to Supabase directly from my side, so the user runs
 * this script locally, which pulls the rows with the service role
 * and writes them to disk. I then read the dump file in-place and
 * use it to regenerate the brand voice seed.
 *
 * The dump file is NOT committed to git — add it to .gitignore
 * before running, or delete it after you're done.
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen.\n" +
      "Stelle sicher, dass .env.local befuellt ist und du das Skript so laufen lässt:\n" +
      "  node --env-file=.env.local scripts/dump-sources.mjs",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, ".sources-dump.json");

async function main() {
  console.log("→ Lade source_posts aus Supabase …");
  const { data, error } = await supabase
    .from("source_posts")
    .select(
      "id, source, channel, title, body, url, is_featured, published_at, tags",
    )
    .order("channel", { ascending: true })
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("❌ Fetch failed:", error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  console.log(`  ✓ ${rows.length} Einträge geladen`);

  // Per-channel summary
  const byChannel = new Map();
  for (const row of rows) {
    const list = byChannel.get(row.channel) ?? [];
    list.push(row);
    byChannel.set(row.channel, list);
  }

  console.log("\n=== Zusammenfassung pro Kanal ===");
  for (const [channel, list] of byChannel.entries()) {
    const lengths = list.map((r) => (r.body ?? "").length);
    const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
    const min = Math.min(...lengths);
    const max = Math.max(...lengths);
    const featured = list.filter((r) => r.is_featured).length;
    console.log(
      `  ${channel.padEnd(12)} ${String(list.length).padStart(3)} Einträge · ` +
        `avg ${String(avg).padStart(5)}z · min ${String(min).padStart(4)}z · ` +
        `max ${String(max).padStart(5)}z · featured: ${featured}`,
    );
  }

  // Write full dump
  const dump = {
    generated_at: new Date().toISOString(),
    total: rows.length,
    rows,
  };
  writeFileSync(outPath, JSON.stringify(dump, null, 2), "utf-8");

  console.log(`\n✅ Dump geschrieben: ${outPath}`);
  console.log(
    "   Der File ist NICHT im Git (siehe .gitignore). Schick den Pfad dem Assistenten.",
  );
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
