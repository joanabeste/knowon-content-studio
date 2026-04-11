import { requireRole } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { InviteUserForm } from "./invite-form";
import { RoleSelect } from "./role-select";

export default async function TeamPage() {
  const { supabase } = await requireRole("admin");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Team</h1>
        <p className="text-muted-foreground">
          Lade Kolleg*innen ein und verwalte ihre Rollen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Neue*n Nutzer*in einladen</CardTitle>
          <CardDescription>
            Die Person bekommt eine E-Mail mit einem Link zum Passwort-Setzen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteUserForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alle Nutzer*innen</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Name</th>
                <th className="pb-2">Rolle</th>
                <th className="pb-2">Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {profiles?.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-3">
                    <div className="font-medium">{p.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.id}</div>
                  </td>
                  <td className="py-3">
                    <RoleSelect userId={p.id} currentRole={p.role} />
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {formatDate(p.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!profiles?.length && (
            <p className="py-4 text-sm text-muted-foreground">
              Noch keine Nutzer*innen.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
