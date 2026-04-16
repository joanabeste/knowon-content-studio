import Link from "next/link";
import { ArrowRight, CalendarClock, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatRelative } from "@/lib/utils";
import {
  CHANNEL_LABELS,
  type Channel,
  type VariantStatus,
} from "@/lib/supabase/types";
import { ApproveProjectButton } from "./approve-button";

export const dynamic = "force-dynamic";

type ReviewRow = {
  id: string;
  project_id: string;
  channel: Channel;
  version: number;
  created_at: string;
  project:
    | {
        topic: string;
        status: VariantStatus;
        assigned_to: string | null;
        review_requested_at: string | null;
        assignee: { full_name: string | null } | null;
      }
    | {
        topic: string;
        status: VariantStatus;
        assigned_to: string | null;
        review_requested_at: string | null;
        assignee: { full_name: string | null } | null;
      }[]
    | null;
};

type ProjectGroup = {
  projectId: string;
  topic: string;
  projectStatus: VariantStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  reviewRequestedAt: string | null;
  variants: Pick<ReviewRow, "id" | "channel" | "version" | "created_at">[];
};

const PROJECT_STATUS_LABEL: Record<VariantStatus, string> = {
  draft: "Entwurf",
  in_review: "Projekt in Review",
  approved: "Projekt freigegeben",
  published: "Projekt veröffentlicht",
};

export default async function ReviewPage() {
  const { supabase, user } = await requireUser();

  const { data } = await supabase
    .from("content_variants")
    .select(
      `id, project_id, channel, version, created_at,
       project:content_projects(
         topic, status, assigned_to, review_requested_at,
         assignee:profiles!content_projects_assigned_to_fkey(full_name)
       )`,
    )
    .eq("status", "in_review")
    .order("created_at", { ascending: false });

  // Group variants by their parent project. PostgREST may return the
  // joined project as a single object or a 1-element array — handle
  // both defensively.
  const groups = new Map<string, ProjectGroup>();
  for (const row of (data ?? []) as unknown as ReviewRow[]) {
    const p = Array.isArray(row.project) ? row.project[0] : row.project;
    const topic = p?.topic ?? "Ohne Thema";
    const projectStatus = p?.status ?? "in_review";
    const assigneeId = p?.assigned_to ?? null;
    const assigneeProfile = p?.assignee;
    const assigneeName = Array.isArray(assigneeProfile)
      ? (assigneeProfile[0]?.full_name ?? null)
      : (assigneeProfile?.full_name ?? null);
    const reviewRequestedAt = p?.review_requested_at ?? null;

    const existing = groups.get(row.project_id);
    const variant = {
      id: row.id,
      channel: row.channel,
      version: row.version,
      created_at: row.created_at,
    };
    if (existing) {
      existing.variants.push(variant);
    } else {
      groups.set(row.project_id, {
        projectId: row.project_id,
        topic,
        projectStatus,
        assigneeId,
        assigneeName,
        reviewRequestedAt,
        variants: [variant],
      });
    }
  }

  const groupList = Array.from(groups.values());
  // Mine first — projects assigned to the logged-in user surface at
  // the top so the reviewer sees their workload immediately.
  groupList.sort((a, b) => {
    const aMine = a.assigneeId === user.id ? 0 : 1;
    const bMine = b.assigneeId === user.id ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;
    // Then by review-requested time (oldest first so urgent ones
    // don't get buried below new submissions)
    const aTime = a.reviewRequestedAt
      ? new Date(a.reviewRequestedAt).getTime()
      : 0;
    const bTime = b.reviewRequestedAt
      ? new Date(b.reviewRequestedAt).getTime()
      : 0;
    return aTime - bTime;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Review-Queue</h1>
        <p className="text-muted-foreground">
          Projekte, die auf Freigabe warten. Zugewiesene Projekte stehen oben.
        </p>
      </div>

      {groupList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Keine offenen Reviews. Alles durchgewunken. 🎉
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {groupList.map((group) => {
            const isMine = group.assigneeId === user.id;
            return (
              <Card
                key={group.projectId}
                className={cn(
                  "overflow-hidden",
                  isMine && "border-amber-500/40 bg-amber-50/40 dark:bg-amber-500/5",
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/projects/${group.projectId}`}
                          className="text-base font-semibold hover:underline"
                        >
                          {group.topic}
                        </Link>
                        <Badge
                          variant="outline"
                          className="border-amber-500/40 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                        >
                          {PROJECT_STATUS_LABEL[group.projectStatus]}
                        </Badge>
                        <Badge variant="muted" className="text-[10px]">
                          {group.variants.length}{" "}
                          {group.variants.length === 1 ? "Kanal" : "Kanäle"}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {group.reviewRequestedAt && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            Angefragt {formatRelative(group.reviewRequestedAt)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="h-3 w-3" />
                          {group.assigneeName ? (
                            <>
                              Reviewer:{" "}
                              <span
                                className={cn(
                                  "font-medium",
                                  isMine && "text-amber-700 dark:text-amber-400",
                                )}
                              >
                                {group.assigneeName}
                                {isMine && " · dir zugewiesen"}
                              </span>
                            </>
                          ) : (
                            <span className="italic">Niemand zugewiesen</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ApproveProjectButton
                        projectId={group.projectId}
                        currentAssigneeId={group.assigneeId}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="divide-y border-t">
                    {group.variants.map((v) => (
                      <li key={v.id}>
                        <Link
                          href={`/projects/${group.projectId}`}
                          className="group flex items-center justify-between gap-3 py-2 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="capitalize"
                            >
                              {CHANNEL_LABELS[v.channel]}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              v{v.version}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              Eingereicht {formatRelative(v.created_at)}
                            </span>
                            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
