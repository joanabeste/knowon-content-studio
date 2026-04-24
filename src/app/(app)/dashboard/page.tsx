import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  FolderOpen,
  CheckCircle2,
  Clock,
  Inbox,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import {
  CHANNEL_LABELS,
  type Channel,
  type VariantStatus,
} from "@/lib/supabase/types";

// Sub-labels per stat card. Used as a one-liner under the big number
// so each card says what it MEANS, not just what it counts.
const STAT_SUBLABELS: Record<
  "draft" | "in_review" | "approved" | "published",
  { normal: string; empty: string }
> = {
  draft: { normal: "Warten auf Überarbeitung", empty: "Keine offenen Entwürfe" },
  in_review: { normal: "Warten auf Freigabe", empty: "Alles abgearbeitet" },
  approved: { normal: "Bereit zum Posten", empty: "Noch nichts freigegeben" },
  published: { normal: "Bereits live", empty: "Noch nichts veröffentlicht" },
};

export default async function DashboardPage() {
  const { supabase, profile } = await requireUser();

  // Fetch recent projects + their variant statuses in one query via
  // PostgREST inner-join expansion. Lets us show per-project progress
  // ("2 von 5 freigegeben") without a second round-trip.
  const { data: recentProjectsRaw } = await supabase
    .from("content_projects")
    .select(
      "id, topic, requested_channels, created_at, content_variants(channel, status)",
    )
    .eq("is_preview", false)
    .order("created_at", { ascending: false })
    .limit(5);

  type RecentProject = {
    id: string;
    topic: string;
    requested_channels: Channel[] | null;
    created_at: string;
    content_variants:
      | { channel: Channel; status: VariantStatus }[]
      | null;
  };
  const recentProjects = (recentProjectsRaw ?? []) as RecentProject[];

  // Aliased join: pull the parent project's topic along with each
  // review-queue variant. Aliasing to `project` keeps the client
  // code decoupled from the actual relation name.
  const { data: reviewQueueRaw } = await supabase
    .from("content_variants")
    .select(
      "id, project_id, channel, status, created_at, project:content_projects(topic)",
    )
    .eq("status", "in_review")
    .order("created_at", { ascending: false })
    .limit(5);

  type ReviewQueueItem = {
    id: string;
    project_id: string;
    channel: Channel;
    status: VariantStatus;
    created_at: string;
    // PostgREST may return the joined row as a single object OR a
    // single-element array depending on how it detects the
    // relationship. Handle both defensively.
    project: { topic: string } | { topic: string }[] | null;
  };
  const reviewQueue = (reviewQueueRaw ?? []) as ReviewQueueItem[];

  // Personal review queue: only variants whose PARENT project is
  // currently assigned to the logged-in user. The `!inner` on the
  // join makes PostgREST do an actual join (not a left-join) so a
  // missing/unfiltered relation drops the row rather than coming
  // back with `project: null`.
  const { data: myReviewsRaw } = await supabase
    .from("content_variants")
    .select(
      "id, project_id, channel, status, created_at, project:content_projects!inner(topic, assigned_to, review_requested_at)",
    )
    .eq("status", "in_review")
    .eq("project.assigned_to", profile.id)
    .order("created_at", { ascending: false })
    .limit(8);

  type MyReviewItem = {
    id: string;
    project_id: string;
    channel: Channel;
    status: VariantStatus;
    created_at: string;
    project:
      | { topic: string; assigned_to: string | null; review_requested_at: string | null }
      | { topic: string; assigned_to: string | null; review_requested_at: string | null }[]
      | null;
  };
  const myReviews = (myReviewsRaw ?? []) as MyReviewItem[];

  // Aggregate variant status counts for the top stats row.
  const { data: statusData } = await supabase
    .from("content_variants")
    .select("status");
  const counts: Record<VariantStatus, number> = {
    draft: 0,
    in_review: 0,
    approved: 0,
    published: 0,
  };
  for (const row of (statusData ?? []) as { status: VariantStatus }[]) {
    counts[row.status] += 1;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold leading-tight">
            Hallo {profile.full_name?.split(" ")[0] || "!"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Bereit, neuen Content für KnowOn zu erzeugen?
          </p>
        </div>
        <Link href="/generate" className={buttonVariants({ size: "lg" })}>
          <Sparkles className="h-4 w-4" />
          Neuen Content erzeugen
        </Link>
      </div>

      {/* Personal review queue — only rendered when the current user
          is explicitly assigned as reviewer on at least one project.
          Placed at the top so "on you" tasks are impossible to miss. */}
      {myReviews.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-500/5">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-white">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-amber-900 dark:text-amber-100">
                    Auf dich wartet {myReviews.length === 1 ? "eine Freigabe" : `${myReviews.length} Freigaben`}
                  </CardTitle>
                  <CardDescription>
                    Du wurdest als Reviewer für diese Projekte zugewiesen.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {myReviews.map((v) => {
                const project = Array.isArray(v.project) ? v.project[0] : v.project;
                const topic = project?.topic;
                const requestedAt = project?.review_requested_at ?? v.created_at;
                return (
                  <li key={v.id}>
                    <Link
                      href={`/projects/${v.project_id}`}
                      className="group flex items-center justify-between gap-3 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-amber-500/40 hover:bg-amber-100/40 dark:hover:bg-amber-500/10"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {topic || "Ohne Thema"}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span>{CHANNEL_LABELS[v.channel as Channel]}</span>
                          <span>·</span>
                          <span>Angefragt {formatRelative(requestedAt)}</span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          href="/projects"
          icon={FolderOpen}
          label="Entwürfe"
          value={counts.draft}
          sublabel={
            counts.draft > 0
              ? STAT_SUBLABELS.draft.normal
              : STAT_SUBLABELS.draft.empty
          }
          color="muted"
        />
        <StatCard
          href="/review"
          icon={Clock}
          label="In Review"
          value={counts.in_review}
          sublabel={
            myReviews.length > 0
              ? `${myReviews.length} davon bei dir`
              : counts.in_review > 0
                ? STAT_SUBLABELS.in_review.normal
                : STAT_SUBLABELS.in_review.empty
          }
          color="amber"
        />
        <StatCard
          href="/projects"
          icon={CheckCircle2}
          label="Freigegeben"
          value={counts.approved}
          sublabel={
            counts.approved > 0
              ? STAT_SUBLABELS.approved.normal
              : STAT_SUBLABELS.approved.empty
          }
          color="teal"
        />
        <StatCard
          href="/projects"
          icon={Sparkles}
          label="Veröffentlicht"
          value={counts.published}
          sublabel={
            counts.published > 0
              ? STAT_SUBLABELS.published.normal
              : STAT_SUBLABELS.published.empty
          }
          color="purple"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Zuletzt erstellt</CardTitle>
                <CardDescription>Deine letzten Projekte</CardDescription>
              </div>
              {recentProjects.length > 0 && (
                <Link
                  href="/projects"
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Alle ansehen
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {recentProjects.length > 0 ? (
              <ul className="space-y-1">
                {recentProjects.map((p) => (
                  <li key={p.id}>
                    <RecentProjectRow project={p} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine Projekte.{" "}
                <Link href="/generate" className="text-primary underline">
                  Erstelle dein erstes
                </Link>
                .
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Offene Reviews</CardTitle>
                <CardDescription>Warten auf Freigabe</CardDescription>
              </div>
              {reviewQueue.length > 0 && (
                <Link
                  href="/review"
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Alle
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {reviewQueue.length > 0 ? (
              <ul className="space-y-1">
                {reviewQueue.map((v) => {
                  const topic = Array.isArray(v.project)
                    ? v.project[0]?.topic
                    : v.project?.topic;
                  return (
                    <li key={v.id}>
                      <Link
                        href={`/projects/${v.project_id}`}
                        className="group flex items-center justify-between gap-3 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {topic || "Ohne Thema"}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span>{CHANNEL_LABELS[v.channel as Channel]}</span>
                            <span>·</span>
                            <span>{formatRelative(v.created_at)}</span>
                          </div>
                        </div>
                        <span
                          className="inline-flex shrink-0 items-center rounded-full border border-amber-500/40 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                          aria-label="In Review"
                        >
                          In Review
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Inbox className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium">Alles abgearbeitet</p>
                <p className="text-xs text-muted-foreground">
                  Keine Varianten warten gerade auf Freigabe.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Richer stat card:
 * - Icon sits in a color-tinted pill (top-right), pulling its own
 *   attention without overpowering the number.
 * - Big bold number (text-3xl) is the visual anchor.
 * - Sub-label below gives the stat *meaning* (e.g., "Warten auf
 *   Freigabe") instead of just counting things.
 * - Whole card is a link with a hover accent, so the affordance
 *   to click through is unambiguous.
 */
function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  sublabel: string;
  color: "muted" | "amber" | "teal" | "purple";
  href?: string;
}) {
  const iconPillColors: Record<typeof color, string> = {
    muted: "bg-muted text-muted-foreground",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    teal: "bg-knowon-teal/10 text-knowon-teal",
    purple: "bg-knowon-purple/10 text-knowon-purple",
  };

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-3xl font-bold leading-none tabular-nums text-foreground">
            {value}
          </div>
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            iconPillColors[color],
          )}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" strokeWidth={2.4} />
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">{sublabel}</div>
    </>
  );

  const baseClass =
    "block rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md";

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {content}
      </Link>
    );
  }
  return <div className={baseClass}>{content}</div>;
}

/**
 * Recent-project row with per-variant progress. Instead of just
 * "here are some channels", it shows how many of those channels
 * are already approved/published — at a glance you see "2 von 5
 * freigegeben" and know whether a project is stale or finished.
 * Channel chips are color-coded via a small dot so you can spot
 * the ones that still need work.
 */
function RecentProjectRow({
  project,
}: {
  project: {
    id: string;
    topic: string;
    requested_channels: Channel[] | null;
    created_at: string;
    content_variants:
      | { channel: Channel; status: VariantStatus }[]
      | null;
  };
}) {
  const variants = project.content_variants ?? [];
  // Latest status per channel (variants may have multiple versions)
  const statusByChannel = new Map<Channel, VariantStatus>();
  for (const v of variants) {
    // First write wins — we rely on PostgREST returning newest first
    // doesn't matter much because only the card-level progress
    // cares, and any approved version "sticks".
    if (!statusByChannel.has(v.channel)) {
      statusByChannel.set(v.channel, v.status);
    }
  }

  // Prefer the requested_channels list for display order; fall back
  // to whatever variants exist.
  const channels: Channel[] =
    project.requested_channels && project.requested_channels.length > 0
      ? project.requested_channels
      : Array.from(statusByChannel.keys());

  const total = channels.length;
  const done = channels.filter((c) => {
    const s = statusByChannel.get(c);
    return s === "approved" || s === "published";
  }).length;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-md border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/50"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground group-hover:text-primary">
            {project.topic}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{formatRelative(project.created_at)}</span>
            {total > 0 && (
              <>
                <span>·</span>
                <span
                  className={cn(
                    done === total
                      ? "font-medium text-knowon-teal"
                      : "text-muted-foreground",
                  )}
                >
                  {done}/{total} freigegeben
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      {channels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {channels.map((ch) => (
            <ChannelPill
              key={ch}
              channel={ch}
              status={statusByChannel.get(ch)}
            />
          ))}
        </div>
      )}
    </Link>
  );
}

function ChannelPill({
  channel,
  status,
}: {
  channel: Channel;
  status: VariantStatus | undefined;
}) {
  const dotColor =
    status === "published"
      ? "bg-knowon-purple"
      : status === "approved"
        ? "bg-knowon-teal"
        : status === "in_review"
          ? "bg-amber-500"
          : status === "draft"
            ? "bg-muted-foreground/40"
            : "border border-dashed border-muted-foreground/40 bg-transparent";

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-foreground/80">
      <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
      {CHANNEL_LABELS[channel]}
    </span>
  );
}
