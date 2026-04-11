"use client";

import { useTransition, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { inviteUser } from "./actions";

export function InviteUserForm() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(
    null,
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg(null);
    const form = new FormData(e.currentTarget);
    start(async () => {
      const res = await inviteUser(form);
      if ("error" in res && res.error)
        setMsg({ type: "error", text: res.error });
      else {
        setMsg({ type: "ok", text: "Einladung verschickt." });
        (e.target as HTMLFormElement).reset();
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Name</Label>
        <Input id="full_name" name="full_name" placeholder="Erika Mustermann" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="erika@knowon.de"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Rolle</Label>
        <select
          id="role"
          name="role"
          defaultValue="editor"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="reviewer">Reviewer</option>
        </select>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Sende…" : "Einladen"}
        </Button>
      </div>
      {msg && (
        <p
          className={`md:col-span-4 text-sm ${
            msg.type === "error" ? "text-destructive" : "text-primary"
          }`}
        >
          {msg.text}
        </p>
      )}
    </form>
  );
}
