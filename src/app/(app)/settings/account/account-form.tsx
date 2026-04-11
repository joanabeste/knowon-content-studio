"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { changeOwnPassword, updateOwnName } from "../team/actions";
import { Loader2 } from "lucide-react";

export function AccountForm({ initialName }: { initialName: string | null }) {
  const [name, setName] = useState(initialName ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pendingName, startName] = useTransition();
  const [pendingPw, startPw] = useTransition();
  const toast = useToast();

  const onSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    startName(async () => {
      const res = await updateOwnName(name);
      if ("error" in res && res.error) toast.show(res.error, "error");
      else toast.show("Name gespeichert.", "success");
    });
  };

  const onChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 5) {
      toast.show("Passwort mind. 5 Zeichen.", "error");
      return;
    }
    if (password !== confirm) {
      toast.show("Passwörter stimmen nicht überein.", "error");
      return;
    }
    startPw(async () => {
      const res = await changeOwnPassword(password);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
      } else {
        toast.show("Passwort aktualisiert.", "success");
        setPassword("");
        setConfirm("");
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Name */}
      <form onSubmit={onSaveName} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vor- und Nachname"
          />
        </div>
        <Button type="submit" disabled={pendingName} variant="outline">
          {pendingName && <Loader2 className="h-4 w-4 animate-spin" />}
          Name speichern
        </Button>
      </form>

      <div className="border-t" />

      {/* Password */}
      <form onSubmit={onChangePassword} className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Passwort ändern</h3>
          <p className="text-sm text-muted-foreground">
            Nach dem Ändern bleibst du eingeloggt.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-password">Neues Passwort</Label>
            <Input
              id="new-password"
              type="password"
              minLength={5}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Bestätigen</Label>
            <Input
              id="confirm-password"
              type="password"
              minLength={5}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>
        <Button type="submit" disabled={pendingPw}>
          {pendingPw && <Loader2 className="h-4 w-4 animate-spin" />}
          Passwort aktualisieren
        </Button>
      </form>
    </div>
  );
}
