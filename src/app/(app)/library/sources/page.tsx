import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
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
import { ManualAddForm } from "./manual-add-form";
import { AddSourcesPanel } from "./add-sources-panel";
import { SourcesList } from "./sources-list";
import { SearchForm } from "./search-form";

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{
    channel?: string;
    source?: string;
    featured?: string;
    q?: string;
    page?: string;
  }>;
}

export default async function SourcesPage({ searchParams }: PageProps) {
  const { supabase, profile } = await requireUser();
  const params = await searchParams;

  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Paginated + filtered list (the actual rows shown)
  let query = supabase
    .from("source_posts")
    .select("*", { count: "exact" })
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("imported_at", { ascending: false })
    .range(from, to);

  if (params.channel && ALL_CHANNELS.includes(params.channel as Channel)) {
    query = query.eq("channel", params.channel);
  }
  if (params.source) {
    query = query.eq("source", params.source);
  }
  if (params.featured === "1") {
    query = query.eq("is_featured", true);
  }
  if (q) {
    // Escape commas and parentheses because Supabase parses them as
    // PostgREST operators. We ilike-search the three text columns;
    // `tags` is a text[] and PostgREST doesn't do partial array
    // matching, so it's excluded from fuzzy search here.
    const safe = q.replace(/[,()]/g, " ");
    query = query.or(
      [
        `title.ilike.%${safe}%`,
        `body.ilike.%${safe}%`,
        `url.ilike.%${safe}%`,
      ].join(","),
    );
  }

  const { data, count } = await query;
  const posts = (data ?? []) as SourcePost[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const isAdmin = profile.role === "admin";
  const canEdit = isAdmin || profile.role === "editor";

  // Global counts for the filter chips (unfiltered totals across all rows)
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

  // Helper to build filter hrefs — preserves q, resets page
  const buildHref = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    const merged = { ...params, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (k === "q") continue;
      if (v === undefined || v === "") continue;
      p.set(k, v);
    }
    p.delete("page"); // reset pagination on filter change
    const qs = p.toString();
    return qs ? `/library/sources?${qs}` : "/library/sources";
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Inspirations-Bibliothek</h1>
        <p className="text-muted-foreground">
          Alte KnowOn-Beiträge aus allen Kanälen. Werden als Stil-Referenz an
          GPT übergeben. Featured (★) werden bevorzugt ausgewählt.
        </p>
      </div>

      {/* Collapsible source-adding panel (editor + admin) */}
      {canEdit && (
        <AddSourcesPanel
          wpSyncButton={<WpSyncButton />}
          eyefoxSyncButton={<EyefoxSyncButton />}
          urlImportForm={<UrlImportForm />}
          manualAddForm={<ManualAddForm />}
        />
      )}

      {/* Sticky search + filter bar — the negative margins match
          the main layout's horizontal padding (px-4 on mobile,
          px-6 on desktop), so the bar bleeds to the edge on both
          viewports. Also `top-14 md:top-0` so on mobile it sits
          under the fixed mobile topbar (h-14) instead of being
          covered by it. */}
      <div className="sticky top-14 z-10 -mx-4 space-y-3 border-b bg-muted/40 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-muted/60 md:-mx-6 md:top-0 md:px-6">
        <SearchForm />

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            label={`Alle (${counts.length})`}
            href={buildHref({
              channel: undefined,
              source: undefined,
              featured: undefined,
            })}
            active={!params.channel && !params.source && !params.featured}
          />
          {(featuredCount > 0 || params.featured === "1") && (
            <FilterChip
              label={`★ Featured (${featuredCount})`}
              href={buildHref({
                channel: undefined,
                source: undefined,
                featured: "1",
              })}
              active={params.featured === "1"}
            />
          )}
          <span className="mx-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Kanäle
          </span>
          {ALL_CHANNELS.map((ch) => {
            const count = channelCounts[ch] ?? 0;
            if (count === 0 && params.channel !== ch) return null;
            return (
              <FilterChip
                key={ch}
                label={`${CHANNEL_LABELS[ch]} (${count})`}
                href={buildHref({
                  channel: ch,
                  source: undefined,
                  featured: undefined,
                })}
                active={params.channel === ch}
              />
            );
          })}
          <span className="mx-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Quellen
          </span>
          {(Object.keys(SOURCE_LABELS) as SourcePostSource[]).map((s) => {
            const count = sourceCounts[s] ?? 0;
            if (count === 0) return null;
            return (
              <FilterChip
                key={s}
                label={`${SOURCE_LABELS[s]} (${count})`}
                href={buildHref({
                  channel: undefined,
                  source: s,
                  featured: undefined,
                })}
                active={params.source === s}
              />
            );
          })}
        </div>
      </div>

      {/* Results meta */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {totalCount === 0
            ? "Keine Treffer"
            : `${totalCount.toLocaleString("de-DE")} ${
                totalCount === 1 ? "Eintrag" : "Einträge"
              }${q ? ` für "${q}"` : ""}`}
        </span>
        {totalPages > 1 && (
          <span>
            Seite {page} von {totalPages}
          </span>
        )}
      </div>

      {/* List with selection + bulk actions */}
      {posts.length > 0 ? (
        <SourcesList
          posts={posts}
          canEdit={canEdit}
          canDelete={isAdmin}
        />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {q
              ? `Keine Treffer für "${q}".`
              : 'Keine Einträge für diesen Filter. Oben „Quellen hinzufügen" öffnen, um welche anzulegen.'}
          </CardContent>
        </Card>
      )}

      {/* Pager */}
      {totalPages > 1 && (
        <Pager
          page={page}
          totalPages={totalPages}
          buildHref={(p) => buildHref({ page: String(p) })}
        />
      )}
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
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-muted")
      }
    >
      {label}
    </Link>
  );
}

function Pager({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (p: number) => string;
}) {
  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (let p = Math.max(1, page - 1); p <= Math.min(totalPages, page + 1); p++) {
    pages.add(p);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);

  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      {page > 1 ? (
        <Link
          href={buildHref(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted"
          aria-label="Vorherige Seite"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-md border opacity-40">
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}
      {sorted.map((p, i) => {
        const prev = sorted[i - 1];
        const showGap = prev !== undefined && p - prev > 1;
        return (
          <span key={p} className="flex items-center gap-1">
            {showGap && (
              <span className="px-1 text-xs text-muted-foreground">…</span>
            )}
            <Link
              href={buildHref(p)}
              className={
                "flex h-8 min-w-[2rem] items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors " +
                (p === page
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted")
              }
            >
              {p}
            </Link>
          </span>
        );
      })}
      {page < totalPages ? (
        <Link
          href={buildHref(page + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted"
          aria-label="Nächste Seite"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-md border opacity-40">
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}
