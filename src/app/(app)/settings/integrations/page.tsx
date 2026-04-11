import { requireRole } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { loadWpCredentials } from "@/lib/wordpress/credentials";
import { verifyCredentials } from "@/lib/wordpress/client";
import { WpCredentialsForm } from "./wp-credentials-form";
import { formatRelative } from "@/lib/utils";
import {
  CHANNEL_LABELS,
  type ContentFeed,
} from "@/lib/supabase/types";
import { AddFeedForm } from "@/app/(app)/library/feeds/add-feed-form";
import { FeedRowActions } from "@/app/(app)/library/feeds/feed-row-actions";
import { SyncAllButton } from "@/app/(app)/library/feeds/sync-all-button";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function IntegrationsPage() {
  await requireRole("admin");

  const wpCreds = await loadWpCredentials();

  // Live-verify WP credentials so we can show a clear status banner
  let wpStatus:
    | { connected: true; name: string; baseUrl: string; username: string }
    | {
        connected: false;
        error: string | null;
        baseUrl?: string;
        username?: string;
      }
    | null = null;

  if (wpCreds) {
    const result = await verifyCredentials(wpCreds);
    if (result.ok) {
      wpStatus = {
        connected: true,
        name: result.name || wpCreds.username,
        baseUrl: wpCreds.baseUrl,
        username: wpCreds.username,
      };
    } else {
      wpStatus = {
        connected: false,
        error: result.error ?? null,
        baseUrl: wpCreds.baseUrl,
        username: wpCreds.username,
      };
    }
  }

  // Feeds
  const supabase = await getSupabaseServer();
  const { data: feedsData } = await supabase
    .from("content_feeds")
    .select("*")
    .order("created_at", { ascending: false });
  const feeds = (feedsData ?? []) as ContentFeed[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrationen</h1>
        <p className="text-muted-foreground">
          Zugangsdaten für externe Dienste und automatisierte Content-Quellen.
        </p>
      </div>

      {/* WordPress */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                WordPress
                {wpStatus?.connected && (
                  <Badge
                    variant="default"
                    className="bg-knowon-teal text-white hover:bg-knowon-teal"
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Verbunden
                  </Badge>
                )}
                {wpStatus && !wpStatus.connected && (
                  <Badge variant="destructive">
                    <AlertTriangle className="mr-1 h-3 w-3" /> Fehler
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Zum Publizieren von Blog-Entwürfen inklusive Featured Image. Du
                brauchst ein <strong>Application Password</strong> aus deinem
                WordPress-Account (
                <span className="font-mono text-xs">
                  Profil → Application Passwords
                </span>
                ). Nicht dein normales Passwort.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {wpStatus?.connected && (
            <div className="rounded-md border border-knowon-teal/40 bg-knowon-teal/5 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-knowon-teal" />
                <div className="space-y-1 text-sm">
                  <div className="font-semibold">
                    Verbunden als {wpStatus.name}
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-mono text-xs">
                      {wpStatus.username}
                    </span>{" "}
                    · {wpStatus.baseUrl}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Blog-Varianten können jetzt als WordPress-Entwurf angelegt
                    oder geplant veröffentlicht werden.
                  </div>
                </div>
              </div>
            </div>
          )}
          {wpStatus && !wpStatus.connected && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="space-y-1 text-sm">
                  <div className="font-semibold">
                    Verbindung fehlgeschlagen
                  </div>
                  <div className="text-muted-foreground">
                    {wpStatus.username} · {wpStatus.baseUrl}
                  </div>
                  {wpStatus.error && (
                    <div className="text-xs text-destructive/80">
                      {wpStatus.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <WpCredentialsForm
            initialBaseUrl={wpCreds?.baseUrl ?? "https://www.knowon.de"}
            initialUsername={wpCreds?.username ?? ""}
            hasPassword={!!wpCreds?.applicationPassword}
          />
        </CardContent>
      </Card>

      {/* RSS Feeds */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>RSS-Feeds</CardTitle>
              <CardDescription>
                Abonniere RSS-/Atom-Feeds, die automatisch in die
                Inspirations-Bibliothek fließen. Für LinkedIn/Instagram-Profile
                erstellst du einen Feed bei{" "}
                <a
                  href="https://rss.app"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  rss.app
                </a>
                . Für den WordPress-Blog reicht{" "}
                <code className="font-mono text-xs">
                  https://www.knowon.de/feed/
                </code>
                . Sync läuft täglich automatisch per Cron-Job.
              </CardDescription>
            </div>
            {feeds.length > 0 && <SyncAllButton />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddFeedForm />

          {feeds.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              {feeds.map((feed) => (
                <div
                  key={feed.id}
                  className="flex items-start justify-between gap-4 rounded-md border bg-card p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {CHANNEL_LABELS[feed.channel]}
                      </Badge>
                      {!feed.is_active && (
                        <Badge variant="outline" className="text-[10px]">
                          Inaktiv
                        </Badge>
                      )}
                      {feed.last_error && (
                        <Badge variant="destructive" className="text-[10px]">
                          Fehler
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-sm font-semibold">
                      {feed.name}
                    </div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {feed.url}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>
                        {feed.last_synced_at
                          ? `Letzter Sync ${formatRelative(feed.last_synced_at)}`
                          : "Noch nicht synchronisiert"}
                      </span>
                      {feed.items_count > 0 && (
                        <>
                          <span>·</span>
                          <span>{feed.items_count} Einträge</span>
                        </>
                      )}
                    </div>
                    {feed.last_error && (
                      <div className="mt-1 text-[11px] text-destructive">
                        {feed.last_error}
                      </div>
                    )}
                  </div>
                  <FeedRowActions
                    feedId={feed.id}
                    feedName={feed.name}
                    isActive={feed.is_active}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
