"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/components/ui/toast";
import { saveSmtpConfig } from "./smtp-actions";
import type { SmtpConfig, SmtpConfigInput } from "./smtp-types";

export function SmtpForm({ initial }: { initial: SmtpConfig }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [passwordConfigured, setPasswordConfigured] = useState(
    initial.password_set,
  );
  const [state, setState] = useState<SmtpConfigInput>({
    host: initial.host,
    port: initial.port,
    username: initial.username,
    password: "",
    from_name: initial.from_name,
    from_email: initial.from_email,
    secure: initial.secure,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveSmtpConfig(state);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("SMTP-Zugang gespeichert.", "success");
      // If a new password was sent, the config is now "set".
      if (state.password && state.password.trim() !== "") {
        setPasswordConfigured(true);
      }
      // Clear the password field regardless — we never echo it back.
      setState((prev) => ({ ...prev, password: "" }));
    });
  };

  const set = <K extends keyof SmtpConfigInput>(
    k: K,
    v: SmtpConfigInput[K],
  ) => setState((prev) => ({ ...prev, [k]: v }));

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
          <Label htmlFor="smtp-pass" className="flex items-center gap-2">
            Passwort
            {passwordConfigured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-knowon-teal/10 px-1.5 py-0.5 text-[10px] font-semibold text-knowon-teal">
                <CheckCircle2 className="h-3 w-3" />
                konfiguriert
              </span>
            )}
          </Label>
          <PasswordInput
            id="smtp-pass"
            value={state.password}
            onChange={(e) => set("password", e.target.value)}
            autoComplete="new-password"
            placeholder={
              passwordConfigured
                ? "••••••••  (leer lassen zum Beibehalten)"
                : "Passwort setzen"
            }
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
        verschlüsselt gespeichert und kommen zum Einsatz, sobald die
        Benachrichtigungs-Funktion freigeschaltet ist (z.B.
        Assignee-Änderung, Review-Request, Freigabe).
      </div>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Speichern
      </Button>
    </form>
  );
}
