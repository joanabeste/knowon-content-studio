"use client";

import { useState, useTransition } from "react";
import {
  Copy,
  Check,
  Edit3,
  Send,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from "lucide-react";
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
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type {
  ContentVariant,
  UserRole,
  VariantStatus,
} from "@/lib/supabase/types";
import { setVariantStatus, updateVariantBody } from "./actions";
import { WpPublishForm } from "./wp-publish-form";

function StatusBadge({ status }: { status: VariantStatus }) {
  const config: Record<
    VariantStatus,
    { label: string; className: string }
  > = {
    draft: {
      label: "Entwurf",
      className: "bg-muted text-muted-foreground",
    },
    in_review: {
      label: "In Review",
      className: "bg-knowon-pink text-white",
    },
    approved: {
      label: "Freigegeben",
      className: "bg-knowon-teal text-white",
    },
    published: {
      label: "Veröffentlicht",
      className: "bg-knowon-purple text-white",
    },
  };
  const { label, className } = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        className,
      )}
    >
      {label}
    </span>
  );
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
  const toast = useToast();

  const canEdit = role === "admin" || role === "editor";
  const canApprove = role === "admin" || role === "reviewer";
  const canPublish = role === "admin" || role === "editor";

  const charLimit =
    variant.channel === "linkedin"
      ? 3000
      : variant.channel === "instagram"
        ? 2200
        : null;
  const overLimit = charLimit !== null && body.length > charLimit;
  const nearLimit = charLimit !== null && body.length > charLimit * 0.9;

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
    toast.show("In Zwischenablage kopiert", "success");
    setTimeout(() => setCopied(false), 1500);
  };

  const save = () => {
    start(async () => {
      const res = await updateVariantBody(variant.id, body, metadata);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("Gespeichert.", "success");
      setEditing(false);
    });
  };

  const sendToReview = () => {
    start(async () => {
      const res = await setVariantStatus(variant.id, "in_review");
      if ("error" in res && res.error) toast.show(res.error, "error");
      else toast.show("Zur Review geschickt.", "success");
    });
  };

  const approve = () => {
    start(async () => {
      const res = await setVariantStatus(variant.id, "approved");
      if ("error" in res && res.error) toast.show(res.error, "error");
      else toast.show("Freigegeben.", "success");
    });
  };

  const sendBackToDraft = () => {
    start(async () => {
      const res = await setVariantStatus(variant.id, "draft");
      if ("error" in res && res.error) toast.show(res.error, "error");
      else toast.show("Zurück in Entwurf.", "success");
    });
  };

  const markPublished = () => {
    start(async () => {
      const res = await setVariantStatus(variant.id, "published");
      if ("error" in res && res.error) toast.show(res.error, "error");
      else toast.show("Als veröffentlicht markiert.", "success");
    });
  };


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle>{channelLabel}</CardTitle>
            <StatusBadge status={variant.status} />
            <span className="text-xs text-muted-foreground">
              v{variant.version}
            </span>
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
          <CardDescription
            className={cn(
              overLimit && "text-destructive font-semibold",
              !overLimit && nearLimit && "text-knowon-pink",
            )}
          >
            {body.length.toLocaleString("de-DE")} /{" "}
            {charLimit.toLocaleString("de-DE")} Zeichen
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Newsletter-specific header fields */}
        {variant.channel === "newsletter" && (
          <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Betreff</Label>
              {editing ? (
                <Input
                  value={(metadata.subject as string) || ""}
                  onChange={(e) =>
                    setMetadata({ ...metadata, subject: e.target.value })
                  }
                />
              ) : (
                <p className="font-medium">
                  {(metadata.subject as string) || "—"}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preheader</Label>
              {editing ? (
                <Input
                  value={(metadata.preheader as string) || ""}
                  onChange={(e) =>
                    setMetadata({ ...metadata, preheader: e.target.value })
                  }
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {(metadata.preheader as string) || "—"}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Blog-specific header fields */}
        {variant.channel === "blog" && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <div className="space-y-1">
              <Label className="text-xs">Titel</Label>
              {editing ? (
                <Input
                  value={(metadata.title as string) || ""}
                  onChange={(e) =>
                    setMetadata({ ...metadata, title: e.target.value })
                  }
                />
              ) : (
                <p className="font-medium">{(metadata.title as string) || "—"}</p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Slug</Label>
                {editing ? (
                  <Input
                    value={(metadata.slug as string) || ""}
                    onChange={(e) =>
                      setMetadata({ ...metadata, slug: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-xs font-mono text-muted-foreground">
                    /{(metadata.slug as string) || "—"}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Meta-Description</Label>
                {editing ? (
                  <Input
                    value={(metadata.meta_description as string) || ""}
                    onChange={(e) =>
                      setMetadata({
                        ...metadata,
                        meta_description: e.target.value,
                      })
                    }
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {(metadata.meta_description as string) || "—"}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs">Inhalt</Label>
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
            <Label className="text-xs">Hashtags</Label>
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
                placeholder="hashtag1 hashtag2 hashtag3"
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

        {variant.channel === "blog" &&
          (metadata.suggested_tags as string[] | undefined)?.length ? (
          <div className="space-y-2">
            <Label className="text-xs">Tags</Label>
            <div className="flex flex-wrap gap-1">
              {(metadata.suggested_tags as string[]).map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {editing && (
            <>
              <Button size="sm" onClick={save} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
            <>
              <Button size="sm" onClick={approve} disabled={pending}>
                <CheckCircle2 className="h-4 w-4" /> Freigeben
              </Button>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={sendBackToDraft}
                  disabled={pending}
                >
                  Zurück in Entwurf
                </Button>
              )}
            </>
          )}
          {!editing &&
            variant.status === "approved" &&
            canPublish &&
            variant.channel !== "blog" && (
              <Button
                size="sm"
                variant="accent"
                onClick={markPublished}
                disabled={pending}
              >
                <ExternalLink className="h-4 w-4" /> Als veröffentlicht markieren
              </Button>
            )}
          {!editing &&
            variant.status === "published" &&
            variant.channel === "blog" &&
            (metadata.wp_post_url as string | undefined) && (
              <a
                href={metadata.wp_post_url as string}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline"
              >
                WordPress-Entwurf öffnen ↗
              </a>
            )}
        </div>

        {/* WordPress-Publish-Panel for blog variants that are approved */}
        {!editing &&
          variant.status === "approved" &&
          variant.channel === "blog" &&
          canPublish && (
            <WpPublishForm
              projectId={variant.project_id}
              variantId={variant.id}
            />
          )}
      </CardContent>
    </Card>
  );
}
