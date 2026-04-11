"use client";

import { useTransition, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createUser } from "./actions";
import { Loader2, UserPlus } from "lucide-react";

export function CreateUserForm() {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      const res = await createUser(form);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
      } else {
        toast.show("Nutzer*in angelegt.", "success");
        formRef.current?.reset();
      }
    });
  };

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="grid gap-4 md:grid-cols-5"
    >
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
        <Label htmlFor="password">Passwort</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={5}
          placeholder="mind. 5 Zeichen"
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
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Anlegen
        </Button>
      </div>
    </form>
  );
}
