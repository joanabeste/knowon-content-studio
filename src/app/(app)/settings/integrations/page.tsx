import { requireRole } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadWpCredentials } from "@/lib/wordpress/credentials";
import { WpCredentialsForm } from "./wp-credentials-form";

export default async function IntegrationsPage() {
  await requireRole("admin");

  const wpCreds = await loadWpCredentials();

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
    </div>
  );
}
