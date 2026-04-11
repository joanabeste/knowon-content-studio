"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Loader2, CheckCircle2 } from "lucide-react";
import {
  saveWordpressCredentials,
  testWordpressCredentials,
} from "./actions";

export function WpCredentialsForm({
  initialBaseUrl,
  initialUsername,
  hasPassword,
}: {
  initialBaseUrl: string;
  initialUsername: string;
  hasPassword: boolean;
}) {
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [pendingSave, startSave] = useTransition();
  const [pendingTest, startTest] = useTransition();
  const toast = useToast();

  const onTest = () => {
    if (!password) {
      toast.show("Bitte Application Password eingeben.", "error");
      return;
    }
    const form = new FormData();
    form.set("base_url", baseUrl);
    form.set("username", username);
    form.set("app_password", password);
    startTest(async () => {
      const res = await testWordpressCredentials(form);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
      } else {
        toast.show(
          `Verbunden als ${("name" in res && res.name) || "OK"}`,
          "success",
        );
      }
    });
  };

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password && !hasPassword) {
      toast.show("Application Password erforderlich.", "error");
      return;
    }
    if (!password) {
      // Keeping old password — not supported in this simple form
      toast.show(
        "Gib das Application Password erneut ein (wird sonst nicht überschrieben).",
        "error",
      );
      return;
    }
    const form = new FormData();
    form.set("base_url", baseUrl);
    form.set("username", username);
    form.set("app_password", password);
    form.set("test", "on");
    startSave(async () => {
      const res = await saveWordpressCredentials(form);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
      } else {
        toast.show("WordPress-Zugangsdaten gespeichert.", "success");
        setPassword("");
      }
    });
  };

  return (
    <form onSubmit={onSave} className="space-y-4">
      {hasPassword && (
        <div className="flex items-center gap-2 rounded-md border border-knowon-teal/40 bg-knowon-teal/5 px-3 py-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-knowon-teal" />
          Aktuell gespeicherte Zugangsdaten vorhanden. Um sie zu überschreiben,
          gib das Passwort erneut ein.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="base_url">WordPress-URL</Label>
          <Input
            id="base_url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            required
            placeholder="https://www.knowon.de"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Benutzername</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="dein-wp-user"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="app_password">Application Password</Label>
        <Input
          id="app_password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={hasPassword ? "••••••••••••••••" : "xxxx xxxx xxxx xxxx"}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Erzeugen im WordPress-Admin: Profil → Application Passwords → neuen
          Key generieren. Format wie{" "}
          <code className="font-mono">xxxx xxxx xxxx xxxx xxxx xxxx</code>.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pendingSave}>
          {pendingSave && <Loader2 className="h-4 w-4 animate-spin" />}
          Speichern (mit Test)
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onTest}
          disabled={pendingTest}
        >
          {pendingTest && <Loader2 className="h-4 w-4 animate-spin" />}
          Nur testen
        </Button>
      </div>
    </form>
  );
}
