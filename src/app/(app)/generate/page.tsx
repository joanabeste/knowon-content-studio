import { requireUser } from "@/lib/auth";
import { GenerateForm } from "./generate-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function GeneratePage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Content erzeugen</h1>
        <p className="text-muted-foreground">
          Ein Thema, ein Briefing — in einem Rutsch fertige Varianten für alle Kanäle.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Briefing</CardTitle>
          <CardDescription>
            Je präziser Thema &amp; Briefing, desto besser der Output.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GenerateForm />
        </CardContent>
      </Card>
    </div>
  );
}
