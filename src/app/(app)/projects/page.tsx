import Link from "next/link";
import { Sparkles, User2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  type Channel,
  type VariantStatus,
} from "@/lib/supabase/types";
import { DeleteProjectButton } from "./[id]/delete-project-button";

interface VariantSummaryRow {
  status: VariantStatus;
  channel: Channel;
  version: number;
}

interface ProjectRow {
  id: string;
  topic: string;
  brief: string | null;
  requested_channels: Channel[] | null;
  created_at: string;
  created_by: string | null;
  profiles: { full_name: string | null } | null;
  content_variants: VariantSummaryRow[] | null;
}

export default async function ProjectsPage() {
  const { supabase, profile } = await requireUser();

  const { data: projectsRaw } = await supabase
    .from("content_projects")
    .select(
      `
        id, topic, brief, requested_channels, created_at, created_by,
        profiles:created_by ( full_name ),
        content_variants ( status, channel, version )
      `,
    )
    .eq("is_preview", false)
    .order("created_at", { ascending: false });

  const projects = (projectsRaw ?? []) as unknown as ProjectRow[];
  const isAdmin = profile.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Projekte</h1>
          <p className="text-muted-foreground">
            Alle Content-Briefings und ihre Kanal-Varianten.
          </p>
        </div>
        <Link
          href="/generate"
          className={buttonVariants({ variant: "default" })}
        >
          <Sparkles className="h-4 w-4" />
          Neuer Content
        </Link>
      </div>

      {!projects?.length ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              Noch keine Projekte.
            </p>
            <Link
              href="/generate"
              className={
                buttonVariants({ size: "sm", variant: "outline" }) + " mt-4"
              }
            >
              <Sparkles className="h-4 w-4" />
              Erstes Projekt anlegen
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <ProjectListItem
              key={p.id}
              project={p}
              canDelete={isAdmin || p.created_by === profile.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectListItem({
  project,
  canDelete,
}: {
  project: ProjectRow;
  canDelete: boolean;
}) {
  const channels =
    project.requested_channels && project.requested_channels.length > 0
      ? project.requested_channels
      : ALL_CHANNELS;

  // Latest variant per channel
  const variants = project.content_variants ?? [];
  const latest = new Map<Channel, VariantStatus>();
  // Sort by version desc so the first seen wins
  const sorted = [...variants].sort((a, b) => b.version - a.version);
  for (const v of sorted) {
    if (!latest.has(v.channel)) latest.set(v.channel, v.status);
  }

  const counts: Record<VariantStatus, number> = {
    draft: 0,
    in_review: 0,
    approved: 0,
    published: 0,
  };
  for (const ch of channels) {
    const s = latest.get(ch);
    if (s) counts[s] += 1;
  }
  const total = channels.length;
  const done = counts.approved + counts.published;

  const creatorName =
    project.profiles?.full_name || "Unbekannt";

  return (
    <Card className="group relative transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-sm">
      <Link href={`/projects/${project.id}`} className="block">
        <CardContent className="space-y-3 p-5">
          {/* Header row: title + date + delete */}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-semibold leading-tight group-hover:text-primary">
                {project.topic}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <User2 className="h-3 w-3" />
                <span>{creatorName}</span>
                <span>·</span>
                <span>{formatRelative(project.created_at)}</span>
              </div>
            </div>
            {canDelete && (
              <div className="relative z-10 shrink-0">
                <DeleteProjectButton
                  projectId={project.id}
                  topic={project.topic}
                  iconOnly
                />
              </div>
            )}
          </div>

          {/* Brief preview */}
          {project.brief && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {project.brief}
            </p>
          )}

          {/* Status + channels row */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <StatusPill
              done={done}
              total={total}
              counts={counts}
            />
            <div className="ml-1 flex flex-wrap gap-1">
              {channels.map((ch) => {
                const status = latest.get(ch);
                return (
                  <ChannelChip key={ch} channel={ch} status={status} />
                );
              })}
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

function StatusPill({
  done,
  total,
  counts,
}: {
  done: number;
  total: number;
  counts: Record<VariantStatus, number>;
}) {
  const allDone = done === total;
  return (
    <div className="flex items-center gap-1.5">
      <Badge
        variant={allDone ? "default" : "muted"}
        className="text-[10px]"
      >
        {done}/{total} freigegeben
      </Badge>
      {counts.in_review > 0 && (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-50 text-[10px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
        >
          {counts.in_review} Review
        </Badge>
      )}
    </div>
  );
}

function ChannelChip({
  channel,
  status,
}: {
  channel: Channel;
  status?: VariantStatus;
}) {
  // Dot color = status of that variant
  const dotColor =
    status === "approved" || status === "published"
      ? "bg-knowon-teal"
      : status === "in_review"
        ? "bg-amber-500"
        : status === "draft"
          ? "bg-muted-foreground/40"
          : "bg-transparent border border-muted-foreground/40";

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium">
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {CHANNEL_LABELS[channel]}
    </span>
  );
}
