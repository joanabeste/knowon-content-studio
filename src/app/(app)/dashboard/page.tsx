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
import { Sparkles } from "lucide-react";

export default async function DashboardPage() {
  const { supabase, profile } = await requireUser();

  const { data: recentProjects } = await supabase
    .from("content_projects")
    .select("id, topic, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: reviewQueue } = await supabase
    .from("content_variants")
    .select("id, project_id, channel, status, created_at")
    .eq("status", "in_review")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Zuletzt bearbeitet</CardTitle>
            <CardDescription>Deine letzten Projekte</CardDescription>
          </CardHeader>
          <CardContent>
            {recentProjects && recentProjects.length > 0 ? (
              <ul className="space-y-2">
                {recentProjects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center justify-between rounded-md p-2 hover:bg-muted"
                    >
                      <div>
                        <div className="font-medium">{p.topic}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(p.created_at)}
                        </div>
                      </div>
                      <Badge variant="muted">{p.status}</Badge>
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
              <ul className="space-y-2">
                {reviewQueue.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/projects/${v.project_id}`}
                      className="flex items-center justify-between rounded-md p-2 hover:bg-muted"
                    >
                      <div className="text-sm capitalize">{v.channel}</div>
                      <Badge variant="accent">In Review</Badge>
                    </Link>
                  </li>
                ))}
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
