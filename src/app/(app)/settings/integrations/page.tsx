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
import { isLinkedinConfigured } from "@/lib/linkedin/client";
import { loadLinkedinConnection } from "@/lib/linkedin/connection";
import { isMetaConfigured } from "@/lib/instagram/client";
import { loadInstagramConnection } from "@/lib/instagram/connection";
import { WpCredentialsForm } from "./wp-credentials-form";
import { LinkedinCard } from "./linkedin-card";
import { InstagramCard } from "./instagram-card";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole("admin");
  const params = await searchParams;

  const [wpCreds, linkedinConn, instagramConn] = await Promise.all([
    loadWpCredentials(),
    loadLinkedinConnection(),
    loadInstagramConnection(),
  ]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrationen</h1>
        <p className="text-muted-foreground">
          Zugangsdaten für externe Dienste.
        </p>
      </div>

      {/* OAuth-Callback-Banner */}
      {params.linkedin_ok && (
        <div className="rounded-md border border-knowon-teal/40 bg-knowon-teal/5 px-4 py-2 text-sm">
          LinkedIn erfolgreich verbunden.
        </div>
      )}
      {params.linkedin_error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          LinkedIn-Fehler: {params.linkedin_error}
        </div>
      )}
      {params.instagram_ok && (
        <div className="rounded-md border border-knowon-teal/40 bg-knowon-teal/5 px-4 py-2 text-sm">
          Instagram erfolgreich verbunden.
        </div>
      )}
      {params.instagram_error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          Instagram-Fehler: {params.instagram_error}
        </div>
      )}

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

      {/* LinkedIn */}
      <Card>
        <CardHeader>
          <CardTitle>LinkedIn</CardTitle>
          <CardDescription>
            Holt die letzten Posts deines persönlichen LinkedIn-Accounts und
            legt sie in der Inspirations-Bibliothek ab, damit GPT sie als
            Stil-Referenz nutzen kann.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LinkedinCard
            configured={isLinkedinConfigured()}
            connected={!!linkedinConn}
            externalName={linkedinConn?.externalName ?? null}
            expiresAt={linkedinConn?.expiresAt?.toISOString() ?? null}
          />
        </CardContent>
      </Card>

      {/* Instagram */}
      <Card>
        <CardHeader>
          <CardTitle>Instagram (Business)</CardTitle>
          <CardDescription>
            Holt die letzten Posts deines Instagram-Business-Accounts über die
            Meta Graph API und legt sie in der Inspirations-Bibliothek ab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InstagramCard
            configured={isMetaConfigured()}
            connected={!!instagramConn}
            externalName={instagramConn?.externalName ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
