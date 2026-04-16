import Link from "next/link";
import { requireUser } from "@/lib/auth";
import type { ProjectIdea } from "@/lib/supabase/types";
import { IdeasClient } from "./ideas-client";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const { supabase, profile, user } = await requireUser();

  const { data: activeRaw } = await supabase
    .from("project_ideas")
    .select(
      `id, title, notes, suggested_channels, target_date, created_by,
       converted_to_project_id, archived_at, created_at, updated_at,
       author:created_by ( full_name )`,
    )
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const { data: archivedRaw } = await supabase
    .from("project_ideas")
    .select(
      `id, title, notes, suggested_channels, target_date, created_by,
       converted_to_project_id, archived_at, created_at, updated_at,
       author:created_by ( full_name )`,
    )
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false })
    .limit(20);

  // PostgREST may return the joined `author` as a single object or a
  // one-element array depending on detected relation shape. Normalise
  // to a single object so ProjectIdea.author stays predictable.
  type RawIdeaRow = Omit<ProjectIdea, "author"> & {
    author:
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
  };
  const normalise = (rows: RawIdeaRow[] | null | undefined): ProjectIdea[] =>
    (rows ?? []).map((r) => ({
      ...r,
      author: Array.isArray(r.author) ? (r.author[0] ?? null) : r.author,
    }));
  const active = normalise(activeRaw as unknown as RawIdeaRow[] | null);
  const archived = normalise(archivedRaw as unknown as RawIdeaRow[] | null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ideen-Backlog</h1>
          <p className="text-muted-foreground">
            Parkplatz für Content-Ideen. Wirf rein, was dir einfällt —
            daraus wird später ein Projekt.
          </p>
        </div>
        <Link
          href="/generate"
          className="text-sm text-muted-foreground underline hover:text-foreground"
        >
          Direkt generieren
        </Link>
      </div>

      <IdeasClient
        active={active}
        archived={archived}
        currentUserId={user.id}
        role={profile.role}
      />
    </div>
  );
}
