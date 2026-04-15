"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { saveSmtpConfig } from "./smtp-actions";
import type { SmtpConfig } from "./smtp-types";

export function SmtpForm({ initial }: { initial: SmtpConfig }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [state, setState] = useState<SmtpConfig>(initial);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveSmtpConfig(state);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("SMTP-Zugang gespeichert.", "success");
    });
  };

  const set = <K extends keyof SmtpConfig>(k: K, v: SmtpConfig[K]) =>
    setState((prev) => ({ ...prev, [k]: v }));

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="smtp-host">Host</Label>
          <Input
            id="smtp-host"
            value={state.host ?? ""}
            onChange={(e) => set("host", e.target.value || null)}
            placeholder="smtp.example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtp-port">Port</Label>
          <Input
            id="smtp-port"
            type="number"
            value={state.port ?? ""}
            onChange={(e) =>
              set("port", e.target.value ? Number(e.target.value) : null)
            }
            placeholder="587"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtp-user">Benutzer</Label>
          <Input
            id="smtp-user"
            value={state.username ?? ""}
            onChange={(e) => set("username", e.target.value || null)}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtp-pass">Passwort</Label>
          <Input
            id="smtp-pass"
            type="password"
            value={state.password ?? ""}
            onChange={(e) => set("password", e.target.value || null)}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtp-from-name">Absender-Name</Label>
          <Input
            id="smtp-from-name"
            value={state.from_name ?? ""}
            onChange={(e) => set("from_name", e.target.value || null)}
            placeholder="KnowOn Marketing"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtp-from-email">Absender-E-Mail</Label>
          <Input
            id="smtp-from-email"
            type="email"
            value={state.from_email ?? ""}
            onChange={(e) => set("from_email", e.target.value || null)}
            placeholder="marketing@knowon.de"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.secure}
          onChange={(e) => set("secure", e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        TLS/SSL aktiv (empfohlen)
      </label>

      <div className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
        <Mail className="mr-1 inline h-3.5 w-3.5" />
        E-Mail-Versand ist noch nicht aktiv. Die Zugangsdaten werden
        gespeichert und kommen zum Einsatz, sobald die
        Benachrichtigungs-Funktion freigeschaltet ist (z.B. Assignee-Änderung,
        Review-Request, Freigabe).
      </div>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Speichern
      </Button>
    </form>
  );
}
