import { requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AccountForm } from "./account-form";

export default async function AccountPage() {
  const { user, profile } = await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mein Account</h1>
        <p className="text-muted-foreground">
          Name und Passwort verwalten.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>
            E-Mail: <span className="font-mono">{user.email}</span>
            <span className="ml-3">
              Rolle: <Badge variant="secondary">{profile.role}</Badge>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountForm initialName={profile.full_name} />
        </CardContent>
      </Card>
    </div>
  );
}
