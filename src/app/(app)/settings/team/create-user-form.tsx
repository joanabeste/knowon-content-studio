"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createUser } from "./actions";
import {
  Loader2,
  UserPlus,
  Eye,
  EyeOff,
  Copy,
  Check,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Generates a strong random password using the browser's Web Crypto
 * API. Uses a hand-picked alphabet that drops ambiguous glyphs
 * (0/O, 1/l/I) so the admin can dictate it by phone if needed.
 */
function generatePassword(length = 16): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function CreateUserForm() {
  const [pending, start] = React.useTransition();
  const [password, setPassword] = React.useState("");
  const [visible, setVisible] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const nameRef = React.useRef<HTMLInputElement>(null);
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
        setPassword("");
        setVisible(false);
        setCopied(false);
        nameRef.current?.focus();
      }
    });
  };

  const onGenerate = () => {
    const pwd = generatePassword(16);
    setPassword(pwd);
    setVisible(true); // reveal right away so the admin sees what got generated
    setCopied(false);
  };

  const onCopy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.show("Passwort kopiert.", "success");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.show("Kopieren fehlgeschlagen.", "error");
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="grid gap-4 md:grid-cols-6"
    >
      <div className="space-y-2">
        <Label htmlFor="full_name">Name</Label>
        <Input
          ref={nameRef}
          id="full_name"
          name="full_name"
          placeholder="Erika Mustermann"
        />
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
      <div className="space-y-2 md:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password">Passwort</Label>
          <button
            type="button"
            onClick={onGenerate}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            <Wand2 className="h-3 w-3" />
            Generieren
          </button>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            required
            minLength={5}
            placeholder="mind. 5 Zeichen"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setCopied(false);
            }}
            className={cn(
              "pr-20 font-mono",
              !visible && "font-sans", // only use mono when revealed
            )}
            autoComplete="new-password"
          />
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
              title={visible ? "Verbergen" : "Anzeigen"}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {visible ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onCopy}
              disabled={!password}
              aria-label="Passwort kopieren"
              title="Kopieren"
              className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? (
                <Check className="h-4 w-4 text-knowon-teal" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
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
