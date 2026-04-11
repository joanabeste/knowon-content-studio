import { requireRole } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadWpCredentials } from "@/lib/wordpress/credentials";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrationen</h1>
        <p className="text-muted-foreground">
          Zugangsdaten für externe Dienste.
        </p>
      </div>

      {/* Error/success banners from OAuth callbacks */}
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

      <Card>
        <CardHeader>
          <CardTitle>WordPress</CardTitle>
          <CardDescription>
            Zum Publizieren von Blog-Entwürfen inklusive Featured Image. Du
            brauchst ein <strong>Application Password</strong> aus deinem
            WordPress-Account (
            <span className="font-mono text-xs">
              Profil → Application Passwords
            </span>
            ). Nicht dein normales Passwort.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WpCredentialsForm
            initialBaseUrl={wpCreds?.baseUrl ?? "https://www.knowon.de"}
            initialUsername={wpCreds?.username ?? ""}
            hasPassword={!!wpCreds?.applicationPassword}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>LinkedIn</CardTitle>
          <CardDescription>
            Holt die letzten Posts deines persönlichen LinkedIn-Accounts und
            legt sie als Golden Examples für zukünftige Generierungen an.
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

      <Card>
        <CardHeader>
          <CardTitle>Instagram (Business)</CardTitle>
          <CardDescription>
            Holt die letzten Posts deines Instagram-Business-Accounts (via Meta
            Graph API) und legt sie als Golden Examples an.
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
