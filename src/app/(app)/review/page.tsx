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

interface ReviewRow {
  id: string;
  project_id: string;
  channel: Channel;
  version: number;
  created_at: string;
}

interface GroupedProject {
  projectId: string;
  topic: string;
  variants: ReviewRow[];
}

export default async function ReviewPage() {
  const { supabase } = await requireUser();

  const { data } = await supabase
    .from("content_variants")
    .select(
      "id, project_id, channel, version, created_at, content_projects(topic)",
    )
    .eq("status", "in_review")
    .order("created_at", { ascending: false });

  const groups = new Map<string, GroupedProject>();
  for (const row of (data ?? []) as unknown as (ReviewRow & {
    content_projects?: { topic?: string };
  })[]) {
    const existing = groups.get(row.project_id);
    const topic = row.content_projects?.topic ?? "Ohne Thema";
    if (existing) {
      existing.variants.push(row);
    } else {
      groups.set(row.project_id, {
        projectId: row.project_id,
        topic,
        variants: [row],
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Review-Queue</h1>
        <p className="text-muted-foreground">
          Varianten, die auf Freigabe warten — gruppiert nach Projekt.
        </p>
      </div>

      {groups.size === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Keine offenen Reviews. Alles durchgewunken. 🎉
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {Array.from(groups.values()).map((group) => (
            <Card key={group.projectId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Link
                    href={`/projects/${group.projectId}`}
                    className="text-base font-semibold hover:underline"
                  >
                    {group.topic}
                  </Link>
                  <Badge variant="accent">
                    {group.variants.length}{" "}
                    {group.variants.length === 1 ? "Variante" : "Varianten"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {group.variants.map((v) => (
                    <li key={v.id}>
                      <Link
                        href={`/projects/${v.project_id}`}
                        className="flex items-center justify-between py-2 hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="capitalize">
                            {CHANNEL_LABELS[v.channel]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            v{v.version}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Eingereicht {formatDate(v.created_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
