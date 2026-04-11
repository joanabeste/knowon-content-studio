"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Edit3, Send, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  ContentVariant,
  UserRole,
  VariantStatus,
} from "@/lib/supabase/types";
import { setVariantStatus, updateVariantBody } from "./actions";

function StatusBadge({ status }: { status: VariantStatus }) {
  const map: Record<VariantStatus, { label: string; variant: "muted" | "accent" | "default" }> = {
    draft: { label: "Entwurf", variant: "muted" },
    in_review: { label: "In Review", variant: "accent" },
    approved: { label: "Freigegeben", variant: "default" },
    published: { label: "Veröffentlicht", variant: "default" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function VariantCard({
  variant,
  channelLabel,
  role,
}: {
  variant: ContentVariant;
  channelLabel: string;
  role: UserRole;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(variant.body);
  const [metadata, setMetadata] = useState<Record<string, unknown>>(
    variant.metadata || {},
  );
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const canEdit = role === "admin" || role === "editor";
  const canApprove = role === "admin" || role === "reviewer";
  const canPublish = role === "admin" || role === "editor";

  const charLimit =
    variant.channel === "linkedin"
      ? 3000
      : variant.channel === "instagram"
        ? 2200
        : null;

  const copy = async () => {
    const parts: string[] = [body];
    if (variant.channel === "linkedin" || variant.channel === "instagram") {
      const hashtags = (metadata.hashtags as string[] | undefined) ?? [];
      if (hashtags.length) parts.push(hashtags.map((h) => `#${h}`).join(" "));
    }
    if (variant.channel === "newsletter") {
      const subject = (metadata.subject as string | undefined) ?? "";
      if (subject) parts.unshift(`Betreff: ${subject}\n`);
    }
    await navigator.clipboard.writeText(parts.join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const save = () => {
    start(async () => {
      await updateVariantBody(variant.id, body, metadata);
      setEditing(false);
    });
  };

  const sendToReview = () => {
    start(async () => {
      await setVariantStatus(variant.id, "in_review");
    });
  };

  const approve = () => {
    start(async () => {
      await setVariantStatus(variant.id, "approved");
    });
  };

  const markPublished = () => {
    start(async () => {
      await setVariantStatus(variant.id, "published");
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle>{channelLabel}</CardTitle>
            <StatusBadge status={variant.status} />
            <span className="text-xs text-muted-foreground">v{variant.version}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? (
                <>
                  <Check className="h-4 w-4" /> Kopiert
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Kopieren
                </>
              )}
            </Button>
            {canEdit && !editing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Edit3 className="h-4 w-4" /> Bearbeiten
              </Button>
            )}
          </div>
        </div>
        {charLimit && (
          <CardDescription>
            {body.length} / {charLimit} Zeichen
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {variant.channel === "newsletter" && (
          <div className="space-y-2">
            <Label>Betreff</Label>
            {editing ? (
              <Input
                value={(metadata.subject as string) || ""}
                onChange={(e) =>
                  setMetadata({ ...metadata, subject: e.target.value })
                }
              />
            ) : (
              <p className="text-sm font-medium">
                {(metadata.subject as string) || "—"}
              </p>
            )}
          </div>
        )}

        {variant.channel === "blog" && (
          <div className="space-y-2">
            <Label>Titel</Label>
            {editing ? (
              <Input
                value={(metadata.title as string) || ""}
                onChange={(e) =>
                  setMetadata({ ...metadata, title: e.target.value })
                }
              />
            ) : (
              <p className="text-sm font-medium">
                {(metadata.title as string) || "—"}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Inhalt</Label>
          {editing ? (
            <Textarea
              rows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="font-mono text-sm"
            />
          ) : (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
              {body}
            </pre>
          )}
        </div>

        {(variant.channel === "linkedin" || variant.channel === "instagram") && (
          <div className="space-y-2">
            <Label>Hashtags</Label>
            {editing ? (
              <Input
                value={((metadata.hashtags as string[]) || []).join(" ")}
                onChange={(e) =>
                  setMetadata({
                    ...metadata,
                    hashtags: e.target.value
                      .split(/\s+/)
                      .map((s) => s.replace(/^#/, ""))
                      .filter(Boolean),
                  })
                }
              />
            ) : (
              <div className="flex flex-wrap gap-1">
                {((metadata.hashtags as string[]) || []).map((h) => (
                  <Badge key={h} variant="secondary">
                    #{h}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {editing && (
            <>
              <Button size="sm" onClick={save} disabled={pending}>
                Speichern
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBody(variant.body);
                  setMetadata(variant.metadata || {});
                  setEditing(false);
                }}
              >
                Abbrechen
              </Button>
            </>
          )}
          {!editing && variant.status === "draft" && canEdit && (
            <Button size="sm" onClick={sendToReview} disabled={pending}>
              <Send className="h-4 w-4" /> Zur Review
            </Button>
          )}
          {!editing && variant.status === "in_review" && canApprove && (
            <Button size="sm" onClick={approve} disabled={pending}>
              <CheckCircle2 className="h-4 w-4" /> Freigeben
            </Button>
          )}
          {!editing && variant.status === "approved" && canPublish && (
            <Button
              size="sm"
              variant="accent"
              onClick={markPublished}
              disabled={pending}
            >
              Als veröffentlicht markieren
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
