import { requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";
import { CHANNEL_LABELS, type ContentFeed } from "@/lib/supabase/types";
import { AddFeedForm } from "./add-feed-form";
import { FeedRowActions } from "./feed-row-actions";
import { SyncAllButton } from "./sync-all-button";

export default async function FeedsPage() {
  const { supabase, profile } = await requireUser();

  const { data } = await supabase
    .from("content_feeds")
    .select("*")
    .order("created_at", { ascending: false });

  const feeds = (data ?? []) as ContentFeed[];
  const isAdmin = profile.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Feeds</h1>
          <p className="text-muted-foreground">
            RSS-/Atom-Feeds, die automatisch in die Inspirations-Bibliothek
            fließen. Ideal für öffentliche LinkedIn- und Instagram-Profile via
            Bridge-Dienste wie{" "}
            <a
              href="https://rss.app"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              rss.app
            </a>
            .
          </p>
        </div>
        {isAdmin && feeds.length > 0 && <SyncAllButton />}
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Feed hinzufügen</CardTitle>
            <CardDescription>
              Erstelle bei rss.app einen Feed für dein LinkedIn-Profil oder
              deine Instagram-Seite und kopiere die RSS-URL hier rein. Für den
              Blog funktioniert direkt{" "}
              <code className="font-mono text-xs">
                https://www.knowon.de/feed/
              </code>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddFeedForm />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {feeds.map((feed) => (
          <Card key={feed.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {CHANNEL_LABELS[feed.channel]}
                    </Badge>
                    {!feed.is_active && (
                      <Badge variant="outline">Inaktiv</Badge>
                    )}
                    {feed.last_error && (
                      <Badge variant="destructive" className="text-[10px]">
                        Fehler
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="truncate text-base">
                    {feed.name}
                  </CardTitle>
                  <CardDescription className="truncate font-mono text-[11px]">
                    {feed.url}
                  </CardDescription>
                </div>
                <FeedRowActions
                  feedId={feed.id}
                  feedName={feed.name}
                  isActive={feed.is_active}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {feed.last_synced_at
                    ? `Letzter Sync ${formatRelative(feed.last_synced_at)}`
                    : "Noch nicht synchronisiert"}
                </span>
                {feed.items_count > 0 && (
                  <>
                    <span>·</span>
                    <span>{feed.items_count} Einträge beim letzten Sync</span>
                  </>
                )}
              </div>
              {feed.last_error && (
                <div className="mt-2 text-xs text-destructive">
                  {feed.last_error}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {!feeds.length && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Noch keine Feeds. Leg oben einen an — du brauchst nur Name,
              Feed-URL und Kanal.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
