"use client";

import { useTransition, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { addExample } from "./actions";

export function AddExampleForm() {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      const res = await addExample(form);
      if (!("error" in res) || !res.error) formRef.current?.reset();
    });
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="channel">Kanal</Label>
          <select
            id="channel"
            name="channel"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="linkedin">LinkedIn</option>
            <option value="instagram">Instagram</option>
            <option value="eyefox">Eyefox</option>
            <option value="newsletter">Newsletter</option>
            <option value="blog">Blog</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Titel (optional)</Label>
          <Input id="title" name="title" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">Inhalt</Label>
        <Textarea id="body" name="body" required rows={6} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">Notiz (warum ist das ein gutes Beispiel?)</Label>
        <Input id="note" name="note" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Speichern…" : "Beispiel speichern"}
      </Button>
    </form>
  );
}
