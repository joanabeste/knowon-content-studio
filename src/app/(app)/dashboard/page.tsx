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
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Sparkles, FolderOpen, CheckCircle2, Clock } from "lucide-react";
import {
  CHANNEL_LABELS,
  type Channel,
  type VariantStatus,
} from "@/lib/supabase/types";

export default async function DashboardPage() {
  const { supabase, profile } = await requireUser();

  const { data: recentProjects } = await supabase
    .from("content_projects")
    .select("id, topic, requested_channels, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: reviewQueue } = await supabase
    .from("content_variants")
    .select("id, project_id, channel, status, created_at, content_projects(topic)")
    .eq("status", "in_review")
    .order("created_at", { ascending: false })
    .limit(5);

  // Aggregate variant status counts
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
          <h1 className="text-3xl font-bold">
            Hallo {profile.full_name?.split(" ")[0] || "!"}
          </h1>
          <p className="text-muted-foreground">
            Bereit, neuen Content für KnowOn zu erzeugen?
          </p>
        </div>
        <Link href="/generate" className={buttonVariants({ size: "lg" })}>
          <Sparkles className="h-4 w-4" />
          Neuen Content erzeugen
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<FolderOpen className="h-4 w-4" />}
          label="Entwürfe"
          value={counts.draft}
          color="muted"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="In Review"
          value={counts.in_review}
          color="pink"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Freigegeben"
          value={counts.approved}
          color="teal"
        />
        <StatCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Veröffentlicht"
          value={counts.published}
          color="purple"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Zuletzt erstellt</CardTitle>
            <CardDescription>Deine letzten Projekte</CardDescription>
          </CardHeader>
          <CardContent>
            {recentProjects && recentProjects.length > 0 ? (
              <ul className="divide-y">
                {recentProjects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="block py-2 hover:bg-muted/50"
                    >
                      <div className="font-medium">{p.topic}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {((p.requested_channels ?? []) as Channel[]).map(
                          (ch) => (
                            <Badge
                              key={ch}
                              variant="muted"
                              className="text-[10px]"
                            >
                              {CHANNEL_LABELS[ch]}
                            </Badge>
                          ),
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDate(p.created_at)}
                      </div>
                    </Link>
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
            <CardTitle>Offene Reviews</CardTitle>
            <CardDescription>Warten auf Freigabe</CardDescription>
          </CardHeader>
          <CardContent>
            {reviewQueue && reviewQueue.length > 0 ? (
              <ul className="divide-y">
                {reviewQueue.map((v) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const topic = (v as any).content_projects?.topic as
                    | string
                    | undefined;
                  return (
                    <li key={v.id}>
                      <Link
                        href={`/projects/${v.project_id}`}
                        className="flex items-center justify-between py-2 hover:bg-muted/50"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            {topic || "Ohne Thema"}
                          </div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {CHANNEL_LABELS[v.channel as Channel]}
                          </div>
                        </div>
                        <Badge variant="accent">In Review</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Keine offenen Reviews.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "muted" | "pink" | "teal" | "purple";
}) {
  const colorMap = {
    muted: "text-muted-foreground",
    pink: "text-knowon-pink",
    teal: "text-knowon-teal",
    purple: "text-knowon-purple",
  };
  return (
    <div className="rounded-lg border bg-card p-4">
      <div
        className={`mb-1 flex items-center gap-1.5 text-xs font-medium ${colorMap[color]}`}
      >
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
