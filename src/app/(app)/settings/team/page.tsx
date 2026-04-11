import { requireRole } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { CreateUserForm } from "./create-user-form";
import { RoleSelect } from "./role-select";
import { DeleteUserButton } from "./delete-user-button";

export default async function TeamPage() {
  const { supabase, user } = await requireRole("admin");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Team</h1>
        <p className="text-muted-foreground">
          Lege Kollegen direkt an und verwalte ihre Rollen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Neuen Nutzer anlegen</CardTitle>
          <CardDescription>
            Kein E-Mail-Versand, kein Bestätigungsschritt. Du vergibst direkt
            ein Passwort, das du der Person intern weitergibst.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateUserForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alle Nutzer</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Name</th>
                <th className="pb-2">Rolle</th>
                <th className="pb-2">Erstellt</th>
                <th className="pb-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {profiles?.map((p) => {
                const isSelf = p.id === user.id;
                return (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-3">
                      <div className="font-medium">
                        {p.full_name || "—"}
                        {isSelf && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (du)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.id}
                      </div>
                    </td>
                    <td className="py-3">
                      <RoleSelect userId={p.id} currentRole={p.role} />
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="py-3">
                      <DeleteUserButton
                        userId={p.id}
                        userName={p.full_name || p.id}
                        disabled={isSelf}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!profiles?.length && (
            <p className="py-4 text-sm text-muted-foreground">
              Noch keine Nutzer.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
