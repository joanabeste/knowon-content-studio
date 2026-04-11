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

export default async function ReviewPage() {
  const { supabase } = await requireUser();

  const { data: pending } = await supabase
    .from("content_variants")
    .select("id, project_id, channel, version, created_at, content_projects(topic)")
    .eq("status", "in_review")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Review-Queue</h1>
        <p className="text-muted-foreground">
          Varianten, die auf Freigabe warten.
        </p>
      </div>
      <div className="grid gap-3">
        {pending?.map((v) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const topic = (v as any).content_projects?.topic as string | undefined;
          return (
            <Link key={v.id} href={`/projects/${v.project_id}`}>
              <Card className="transition-colors hover:border-primary">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {topic || "Ohne Thema"}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {v.channel}
                      </Badge>
                      <Badge variant="accent">In Review</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Eingereicht {formatDate(v.created_at)} · v{v.version}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {!pending?.length && (
          <p className="text-sm text-muted-foreground">
            Keine offenen Reviews. 🎉
          </p>
        )}
      </div>
    </div>
  );
}
