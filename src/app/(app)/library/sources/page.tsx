import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  SOURCE_LABELS,
  type Channel,
  type SourcePost,
  type SourcePostSource,
} from "@/lib/supabase/types";
import { WpSyncButton } from "./wp-sync-button";
import { EyefoxSyncButton } from "./eyefox-sync-button";
import { UrlImportForm } from "./url-import-form";
import { SourceRowActions } from "./source-row-actions";

interface PageProps {
  searchParams: Promise<{
    channel?: string;
    source?: string;
    featured?: string;
  }>;
}

export default async function SourcesPage({ searchParams }: PageProps) {
  const { supabase, profile } = await requireUser();
  const params = await searchParams;

  let query = supabase
    .from("source_posts")
    .select("*")
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("imported_at", { ascending: false })
    .limit(100);

  if (params.channel && ALL_CHANNELS.includes(params.channel as Channel)) {
    query = query.eq("channel", params.channel);
  }
  if (params.source) {
    query = query.eq("source", params.source);
  }
  if (params.featured === "1") {
    query = query.eq("is_featured", true);
  }

  const { data } = await query;
  const posts = (data ?? []) as SourcePost[];

  const isAdmin = profile.role === "admin";
  const canEdit = isAdmin || profile.role === "editor";

  // Global counts for the filter badges
  const { data: allCounts } = await supabase
    .from("source_posts")
    .select("channel, source, is_featured");
  const counts = (allCounts ?? []) as Array<{
    channel: Channel;
    source: SourcePostSource;
    is_featured: boolean;
  }>;
  const channelCounts: Partial<Record<Channel, number>> = {};
  const sourceCounts: Partial<Record<SourcePostSource, number>> = {};
  let featuredCount = 0;
  for (const c of counts) {
    channelCounts[c.channel] = (channelCounts[c.channel] ?? 0) + 1;
    sourceCounts[c.source] = (sourceCounts[c.source] ?? 0) + 1;
    if (c.is_featured) featuredCount += 1;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inspirations-Bibliothek</h1>
        <p className="text-muted-foreground">
          Alte KnowOn-Beiträge aus allen Kanälen. Werden als Stil-Referenz an
          GPT übergeben. „Featured" (★) werden bevorzugt ausgewählt.
        </p>
      </div>

      {/* Sync panels (admin only) */}
      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">WordPress-Sync</CardTitle>
              <CardDescription>Holt Blog-Posts von knowon.de.</CardDescription>
            </CardHeader>
            <CardContent>
              <WpSyncButton />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Eyefox-Sync</CardTitle>
              <CardDescription>
                Scraped die Partnerseite (best-effort, fragil).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EyefoxSyncButton />
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">URL-Import</CardTitle>
              <CardDescription>
                Einzelne öffentliche URLs (z.B. LinkedIn-Post-Link,
                Instagram-Permalink, Eyefox-Artikel) importieren. Der Server
                holt den Text aus og:title + Body.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UrlImportForm />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label={`Alle (${counts.length})`}
          href="/library/sources"
          active={!params.channel && !params.source && !params.featured}
        />
        <FilterChip
          label={`★ Featured (${featuredCount})`}
          href="/library/sources?featured=1"
          active={params.featured === "1"}
        />
        <span className="text-xs text-muted-foreground">Kanäle:</span>
        {ALL_CHANNELS.map((ch) => (
          <FilterChip
            key={ch}
            label={`${CHANNEL_LABELS[ch]} (${channelCounts[ch] ?? 0})`}
            href={`/library/sources?channel=${ch}`}
            active={params.channel === ch}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Quellen:</span>
        {(Object.keys(SOURCE_LABELS) as SourcePostSource[]).map((s) => {
          const count = sourceCounts[s] ?? 0;
          if (count === 0) return null;
          return (
            <FilterChip
              key={s}
              label={`${SOURCE_LABELS[s]} (${count})`}
              href={`/library/sources?source=${s}`}
              active={params.source === s}
            />
          );
        })}
      </div>

      {/* List */}
      <div className="grid gap-3">
        {posts.map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1">
                    {p.is_featured && (
                      <Badge variant="accent" className="text-[10px]">
                        ★ Featured
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px]">
                      {CHANNEL_LABELS[p.channel]}
                    </Badge>
                    <Badge variant="muted" className="text-[10px]">
                      {SOURCE_LABELS[p.source]}
                    </Badge>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        ↗
                      </a>
                    )}
                  </div>
                  <CardTitle className="truncate text-base">
                    {p.title || p.body.slice(0, 80)}
                  </CardTitle>
                </div>
                <SourceRowActions
                  id={p.id}
                  isFeatured={p.is_featured}
                  canEdit={canEdit}
                  canDelete={isAdmin}
                />
              </div>
              <CardDescription>
                {p.published_at ? formatDate(p.published_at) : "Ohne Datum"} ·{" "}
                {p.body.length.toLocaleString("de-DE")} Zeichen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="line-clamp-3 text-sm text-muted-foreground">
                {p.body.slice(0, 400)}
              </p>
            </CardContent>
          </Card>
        ))}
        {!posts.length && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Keine Einträge für diesen Filter. Synce oben etwas oder füge via
              URL-Import hinzu.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-muted")
      }
    >
      {label}
    </Link>
  );
}
