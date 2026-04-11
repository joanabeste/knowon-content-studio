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

export default async function IntegrationsPage() {
  await requireRole("admin");

  const wpCreds = await loadWpCredentials();

  // If credentials exist, verify them live so we can show a clear status
  let wpStatus:
    | { connected: true; name: string; baseUrl: string; username: string }
    | { connected: false; error: string | null; baseUrl?: string; username?: string }
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
    </div>
  );
}
