import { requireRole } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function IntegrationsPage() {
  await requireRole("admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrationen</h1>
        <p className="text-muted-foreground">
          WordPress, Brevo &amp; weitere Anbindungen.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>In Vorbereitung</CardTitle>
          <CardDescription>
            WordPress-Sync &amp; Publish sowie Brevo-Draft kommen in Phase 2/3.
            Aktuell werden Keys via <code>.env.local</code> gelesen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>WordPress</strong>: <code>WORDPRESS_BASE_URL</code>,{" "}
            <code>WORDPRESS_USERNAME</code>, <code>WORDPRESS_APP_PASSWORD</code>
          </p>
          <p>
            <strong>Brevo</strong>: <code>BREVO_API_KEY</code>
          </p>
          <p>
            <strong>OpenAI</strong>: <code>OPENAI_API_KEY</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
