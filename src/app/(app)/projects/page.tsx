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

export default async function ProjectsPage() {
  const { supabase } = await requireUser();

  const { data: projects } = await supabase
    .from("content_projects")
    .select("id, topic, brief, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Projekte</h1>
        <p className="text-muted-foreground">
          Alle Content-Briefings und ihre Kanal-Varianten.
        </p>
      </div>

      <div className="grid gap-4">
        {projects?.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <Card className="transition-colors hover:border-primary">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-lg">{p.topic}</CardTitle>
                  <Badge variant="muted">{p.status}</Badge>
                </div>
              </CardHeader>
              {p.brief && (
                <CardContent>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {p.brief}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDate(p.created_at)}
                  </p>
                </CardContent>
              )}
            </Card>
          </Link>
        ))}
        {!projects?.length && (
          <p className="text-sm text-muted-foreground">
            Noch keine Projekte.
          </p>
        )}
      </div>
    </div>
  );
}
