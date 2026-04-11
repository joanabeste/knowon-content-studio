import { requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { WpSyncButton } from "./wp-sync-button";
import type { SourcePost } from "@/lib/supabase/types";

export default async function SourcesPage() {
  const { supabase, profile } = await requireUser();

  const { data } = await supabase
    .from("source_posts")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(50);

  const posts = (data ?? []) as SourcePost[];
  const isAdmin = profile.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Quellen-Bibliothek</h1>
        <p className="text-muted-foreground">
          Alte KnowOn-Beiträge als Inspirationsquelle für neue Generierungen.
        </p>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>WordPress-Sync</CardTitle>
            <CardDescription>
              Holt die neuesten Beiträge von knowon.de (oder einer anderen
              WordPress-Site) über die öffentliche REST-API und legt sie
              zusätzlich als Blog-Beispiele für GPT an.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WpSyncButton />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {posts.map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{p.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="muted" className="text-[10px] capitalize">
                    {p.source}
                  </Badge>
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      ↗
                    </a>
                  )}
                </div>
              </div>
              <CardDescription>
                {p.published_at ? formatDate(p.published_at) : "Ohne Datum"} ·{" "}
                {p.body.length.toLocaleString("de-DE")} Zeichen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="line-clamp-3 text-sm text-muted-foreground">
                {p.body.slice(0, 300)}
              </p>
            </CardContent>
          </Card>
        ))}
        {!posts.length && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Noch keine Quell-Beiträge. Oben „Sync" klicken.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
