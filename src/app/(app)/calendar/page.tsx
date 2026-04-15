import { requireUser } from "@/lib/auth";
import type {
  Channel,
  VariantStatus,
} from "@/lib/supabase/types";
import { CalendarClient } from "./calendar-client";

export const dynamic = "force-dynamic";

export type CalendarEntry = {
  id: string;
  project_id: string;
  project_topic: string;
  channel: Channel;
  status: VariantStatus;
  version: number;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  author_id: string | null;
  author_name: string | null;
  reviewer_id: string | null;
  reviewer_name: string | null;
  /**
   * Which timestamp the calendar anchors this entry on. We prefer
   * `scheduled_at` if set, else `published_at`, else `created_at`
   * so every variant has a slot even before anyone planned it.
   */
  anchor_date: string;
};

export type ProjectOption = { id: string; topic: string };
export type PersonOption = { id: string; full_name: string };

type SearchParams = Record<string, string | string[] | undefined>;

function toAnchorDate(params: SearchParams): Date {
  const raw = typeof params.d === "string" ? params.d : null;
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { supabase, profile } = await requireUser();

  // Anchor the query range around the current view. We always load
  // a 3-month window so switching between month/week/list views
  // doesn't trigger a refetch — filters are applied client-side.
  const anchor = toAnchorDate(params);
  const rangeStart = new Date(anchor);
  rangeStart.setMonth(rangeStart.getMonth() - 1);
  rangeStart.setDate(1);
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(anchor);
  rangeEnd.setMonth(rangeEnd.getMonth() + 2);
  rangeEnd.setDate(0);
  rangeEnd.setHours(23, 59, 59, 999);

  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();

  // Preview projects (is_preview=true) live in limbo — their variants
  // shouldn't pollute the editorial calendar. Pull the IDs once and
  // exclude them from the variant query below.
  const { data: previewIds } = await supabase
    .from("content_projects")
    .select("id")
    .eq("is_preview", true);
  const previewProjectIds = (previewIds ?? []).map(
    (r) => (r as { id: string }).id,
  );

  // Fetch variants whose scheduled_at OR published_at OR created_at
  // falls inside the window. We can't express an OR across three
  // columns in a single PostgREST filter cleanly, so we use the
  // `.or()` helper.
  let variantsQuery = supabase
    .from("content_variants")
    .select(
      `
        id, project_id, channel, status, version,
        scheduled_at, published_at, created_at,
        created_by, reviewed_by,
        author:created_by ( full_name ),
        reviewer:reviewed_by ( full_name ),
        project:content_projects ( topic )
      `,
    )
    .or(
      `and(scheduled_at.gte.${startIso},scheduled_at.lte.${endIso}),` +
        `and(published_at.gte.${startIso},published_at.lte.${endIso}),` +
        `and(scheduled_at.is.null,published_at.is.null,created_at.gte.${startIso},created_at.lte.${endIso})`,
    )
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  if (previewProjectIds.length > 0) {
    variantsQuery = variantsQuery.not(
      "project_id",
      "in",
      `(${previewProjectIds.join(",")})`,
    );
  }
  const { data: variantsRaw, error } = await variantsQuery;

  if (error) {
    console.error("[calendar] fetch error", error);
  }

  type RawRow = {
    id: string;
    project_id: string;
    channel: Channel;
    status: VariantStatus;
    version: number;
    scheduled_at: string | null;
    published_at: string | null;
    created_at: string;
    created_by: string | null;
    reviewed_by: string | null;
    author: { full_name: string | null } | null;
    reviewer: { full_name: string | null } | null;
    project: { topic: string } | null;
  };

  const rows = (variantsRaw ?? []) as unknown as RawRow[];

  const entries: CalendarEntry[] = rows.map((r) => ({
    id: r.id,
    project_id: r.project_id,
    project_topic: r.project?.topic ?? "(Unbekannt)",
    channel: r.channel,
    status: r.status,
    version: r.version,
    scheduled_at: r.scheduled_at,
    published_at: r.published_at,
    created_at: r.created_at,
    author_id: r.created_by,
    author_name: r.author?.full_name ?? null,
    reviewer_id: r.reviewed_by,
    reviewer_name: r.reviewer?.full_name ?? null,
    anchor_date: r.scheduled_at ?? r.published_at ?? r.created_at,
  }));

  // Load project + person options for the filter dropdowns. Cheap
  // enough to load all — teams are small.
  const [{ data: projectsData }, { data: peopleData }] = await Promise.all([
    supabase
      .from("content_projects")
      .select("id, topic")
      .eq("is_preview", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name", { ascending: true }),
  ]);

  const projects: ProjectOption[] = (projectsData ?? []).map((p) => ({
    id: (p as { id: string }).id,
    topic: (p as { topic: string }).topic,
  }));
  const people: PersonOption[] = (peopleData ?? [])
    .map((p) => ({
      id: (p as { id: string }).id,
      full_name: (p as { full_name: string | null }).full_name ?? "",
    }))
    .filter((p) => p.full_name.trim() !== "");

  const canEdit = profile.role === "admin" || profile.role === "editor";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Posting-Kalender</h1>
        <p className="text-muted-foreground">
          Übersicht aller geplanten und veröffentlichten Varianten.
        </p>
      </div>
      <CalendarClient
        entries={entries}
        projects={projects}
        people={people}
        canEdit={canEdit}
        anchorIso={anchor.toISOString()}
        initialView={
          typeof params.view === "string" ? params.view : undefined
        }
        initialFilters={{
          status:
            typeof params.status === "string"
              ? params.status.split(",").filter(Boolean)
              : [],
          channel:
            typeof params.channel === "string"
              ? params.channel.split(",").filter(Boolean)
              : [],
          project:
            typeof params.project === "string" ? params.project : null,
          owner: typeof params.owner === "string" ? params.owner : null,
        }}
      />
    </div>
  );
}
