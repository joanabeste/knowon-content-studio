import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { CHANNEL_LABELS, type Channel } from "@/lib/supabase/types";

export default async function ProjectsPage() {
  const { supabase } = await requireUser();

  const { data: projects } = await supabase
    .from("content_projects")
    .select("id, topic, brief, requested_channels, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Projekte</h1>
        <p className="text-muted-foreground">
          Alle Content-Briefings und ihre Kanal-Varianten.
        </p>
      </div>

      {!projects?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Noch keine Projekte.{" "}
            <Link href="/generate" className="text-primary underline">
              Erstelle dein erstes
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="transition-colors hover:border-primary">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-lg">{p.topic}</CardTitle>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(p.created_at)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {p.brief && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {p.brief}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {((p.requested_channels ?? []) as Channel[]).map((ch) => (
                      <Badge key={ch} variant="secondary">
                        {CHANNEL_LABELS[ch]}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
