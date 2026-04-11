import { requireUser } from "@/lib/auth";
import { hasRole } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddExampleForm } from "./add-example-form";
import { DeleteExampleButton } from "./delete-button";
import type { GoldenExample } from "@/lib/supabase/types";

export default async function ExamplesPage() {
  const { supabase, profile } = await requireUser();
  const isAdmin = hasRole(profile, "admin");

  const { data } = await supabase
    .from("golden_examples")
    .select("*")
    .order("created_at", { ascending: false });

  const examples = (data as GoldenExample[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Golden Examples</h1>
        <p className="text-muted-foreground">
          Vorzeige-Beiträge, die den KnowOn-Stil prägen. Fließen in jede Generierung ein.
        </p>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Beispiel hinzufügen</CardTitle>
            <CardDescription>
              Nur für Admins sichtbar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddExampleForm />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {examples.map((ex) => (
          <Card key={ex.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {ex.channel}
                  </Badge>
                  {ex.title && (
                    <CardTitle className="text-base">{ex.title}</CardTitle>
                  )}
                </div>
                {isAdmin && <DeleteExampleButton id={ex.id} />}
              </div>
              {ex.note && <CardDescription>{ex.note}</CardDescription>}
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                {ex.body}
              </pre>
            </CardContent>
          </Card>
        ))}
        {!examples.length && (
          <p className="text-sm text-muted-foreground">
            Noch keine Beispiele.
          </p>
        )}
      </div>
    </div>
  );
}
