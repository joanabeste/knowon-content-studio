"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Copy,
  Check,
  Edit3,
  Send,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Trash2,
  MessageSquare,
  User as UserIcon,
  CalendarClock,
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
import { cn, formatRelative } from "@/lib/utils";
import { cleanHashtags, normalizeHashtag } from "@/lib/hashtags";
import type {
  ContentVariantWithPeople,
  UserRole,
  VariantNote,
  VariantStatus,
} from "@/lib/supabase/types";
import {
  addVariantNote,
  deleteVariant,
  deleteVariantNote,
  listWpCategoryNames,
  setVariantSchedule,
  setVariantStatus,
  updateVariantBody,
} from "./actions";
import { WpPublishForm } from "./wp-publish-form";
import {
  ApplyNoteButton,
  RegenerateVariantButton,
  VersionHistory,
} from "./variant-extras";

const STATUS_CONFIG: Record<
  VariantStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Entwurf",
    className: "bg-muted text-muted-foreground",
  },
  in_review: {
    // Warm amber — signals "waiting for attention" without being
    // alarming like the brand pink (which reads as error/destructive).
    label: "In Review",
    className: "bg-amber-500 text-white",
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

const STATUS_ORDER: VariantStatus[] = [
  "draft",
  "in_review",
  "approved",
  "published",
];

function StatusBadge({ status }: { status: VariantStatus }) {
  const { label, className } = STATUS_CONFIG[status];
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

/**
 * Editable status pill. Uses a native <select> styled to look like a
 * pill badge. On change, calls setVariantStatus server action.
 */
function StatusSelect({
  variant,
  onChanged,
}: {
  variant: ContentVariantWithPeople;
  onChanged?: (status: VariantStatus) => void;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as VariantStatus;
    if (next === variant.status) return;
    start(async () => {
      const res = await setVariantStatus(variant.id, next);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show(`Status: ${STATUS_CONFIG[next].label}`, "success");
      onChanged?.(next);
    });
  };

  const { className } = STATUS_CONFIG[variant.status];

  return (
    <select
      value={variant.status}
      onChange={onChange}
      disabled={pending}
      aria-label="Status ändern"
      className={cn(
        "cursor-pointer appearance-none rounded-full border-0 py-0.5 pl-2.5 pr-6 text-xs font-semibold transition-opacity",
        "bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2012%2012%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m3%204.5%203%203%203-3%22%2F%3E%3C%2Fsvg%3E')]",
        "bg-[length:12px_12px] bg-no-repeat bg-[position:right_6px_center]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        pending && "opacity-60",
        className,
      )}
    >
      {STATUS_ORDER.map((s) => (
        <option
          key={s}
          value={s}
          className="bg-background text-foreground"
        >
          {STATUS_CONFIG[s].label}
        </option>
      ))}
    </select>
  );
}

/**
 * Inline scheduler: compact datetime-local input next to a "geplant
 * am" label. For editors/admins, saves on blur/change. For reviewers,
 * renders read-only text instead.
 */
function SchedulePicker({
  variant,
  canEdit,
}: {
  variant: ContentVariantWithPeople;
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const [value, setValue] = useState<string>(() =>
    toLocalInputValue(variant.scheduled_at),
  );

  const save = (next: string) => {
    start(async () => {
      const res = await setVariantSchedule(variant.id, next || null);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show(next ? "Termin gespeichert." : "Termin entfernt.", "success");
    });
  };

  if (!canEdit) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" />
        <span>
          {variant.scheduled_at
            ? `Geplant: ${formatRelative(variant.scheduled_at)}`
            : "Kein Termin geplant"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs">
      <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
      <Label className="text-xs text-muted-foreground">
        Geplant für
      </Label>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value !== toLocalInputValue(variant.scheduled_at)) {
            save(value);
          }
        }}
        disabled={pending}
        className="rounded border bg-background px-2 py-0.5 text-xs"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            save("");
          }}
          className="text-[11px] text-muted-foreground underline hover:text-foreground"
        >
          Termin löschen
        </button>
      )}
    </div>
  );
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function VariantCard({
  variant,
  channelLabel,
  role,
  notes,
  currentUserId,
}: {
  variant: ContentVariantWithPeople;
  channelLabel: string;
  role: UserRole;
  notes: VariantNote[];
  currentUserId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(variant.body);
  const [metadata, setMetadata] = useState<Record<string, unknown>>(
    variant.metadata || {},
  );
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  // Existing WordPress categories — lazy-loaded the first time the
  // user opens a blog variant for editing. Stays in state afterwards
  // so the list doesn't re-fetch on every edit/cancel cycle.
  const [wpCategories, setWpCategories] = useState<string[]>([]);
  const [wpCategoriesLoaded, setWpCategoriesLoaded] = useState(false);
  useEffect(() => {
    if (!editing || variant.channel !== "blog" || wpCategoriesLoaded) return;
    let cancelled = false;
    listWpCategoryNames().then((res) => {
      if (cancelled) return;
      setWpCategoriesLoaded(true);
      if ("names" in res) setWpCategories(res.names);
    });
    return () => {
      cancelled = true;
    };
  }, [editing, variant.channel, wpCategoriesLoaded]);

  const toggleCategory = (name: string) => {
    const current = (metadata.suggested_categories as string[] | undefined) || [];
    const active = current.some((c) => c.toLowerCase() === name.toLowerCase());
    const next = active
      ? current.filter((c) => c.toLowerCase() !== name.toLowerCase())
      : [...current, name];
    setMetadata({ ...metadata, suggested_categories: next });
  };

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
      const hashtags = cleanHashtags(metadata.hashtags as string[] | undefined);
      if (hashtags.length) {
        parts.push(hashtags.map((h) => `#${h}`).join(" "));
      }
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

  const onDeleteVariant = () => {
    if (
      !confirm(
        `${channelLabel}-Variante wirklich löschen? Das kann nicht rückgängig gemacht werden — der Kanal verschwindet aus diesem Projekt.`,
      )
    ) {
      return;
    }
    start(async () => {
      const res = await deleteVariant(variant.id);
      if ("error" in res && res.error) toast.show(res.error, "error");
      else toast.show(`${channelLabel}-Variante gelöscht.`, "success");
    });
  };


  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{channelLabel}</CardTitle>
            {canEdit ? (
              <StatusSelect variant={variant} />
            ) : (
              <StatusBadge status={variant.status} />
            )}
            <VersionHistory variant={variant} canRestore={canEdit} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            {canEdit && !editing && (
              <RegenerateVariantButton variantId={variant.id} disabled={pending} />
            )}
            {canEdit && !editing && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDeleteVariant}
                disabled={pending}
                title="Variante löschen"
                className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <AttributionLine variant={variant} />
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
        <SchedulePicker variant={variant} canEdit={canEdit} />

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
            <Label className="text-xs">Mögliche Hashtags</Label>
            {editing ? (
              <Input
                value={cleanHashtags(metadata.hashtags as string[] | undefined).join(" ")}
                onChange={(e) =>
                  setMetadata({
                    ...metadata,
                    hashtags: e.target.value
                      .split(/\s+/)
                      .map(normalizeHashtag)
                      .filter(Boolean),
                  })
                }
                placeholder="hashtag1 hashtag2 hashtag3"
              />
            ) : (
              <div className="flex flex-wrap gap-1">
                {cleanHashtags(metadata.hashtags as string[] | undefined).map(
                  (clean) => (
                    <Badge key={clean} variant="secondary">
                      #{clean}
                    </Badge>
                  ),
                )}
              </div>
            )}
          </div>
        )}

        {variant.channel === "blog" && (
          <div className="space-y-2">
            <Label className="text-xs">Tags</Label>
            {editing ? (
              <Input
                value={((metadata.suggested_tags as string[]) || []).join(", ")}
                onChange={(e) =>
                  setMetadata({
                    ...metadata,
                    suggested_tags: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Tag 1, Tag 2, Tag 3"
              />
            ) : (metadata.suggested_tags as string[] | undefined)?.length ? (
              <div className="flex flex-wrap gap-1">
                {(metadata.suggested_tags as string[]).map((t) => (
                  <Badge key={t} variant="outline">
                    {t}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">—</p>
            )}
          </div>
        )}

        {variant.channel === "blog" && (
          <div className="space-y-2">
            <Label className="text-xs">Kategorien</Label>
            {editing ? (
              <div className="space-y-2">
                <Input
                  value={(
                    (metadata.suggested_categories as string[]) || []
                  ).join(", ")}
                  onChange={(e) =>
                    setMetadata({
                      ...metadata,
                      suggested_categories: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Kategorie 1, Kategorie 2"
                />
                {wpCategories.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      In WordPress:
                    </span>
                    {wpCategories.map((name) => {
                      const active = (
                        (metadata.suggested_categories as string[]) || []
                      ).some(
                        (c) => c.toLowerCase() === name.toLowerCase(),
                      );
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => toggleCategory(name)}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background hover:bg-muted",
                          )}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (metadata.suggested_categories as string[] | undefined)
                ?.length ? (
              <div className="flex flex-wrap gap-1">
                {(metadata.suggested_categories as string[]).map((c) => (
                  <Badge key={c} variant="secondary">
                    {c}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">—</p>
            )}
          </div>
        )}

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
                WordPress-Post öffnen ↗
              </a>
            )}
        </div>

        {/* WordPress-Publish-Panel for blog variants:
            - status=approved → first-time send (create new post)
            - status=published → post exists in WP, enables updates/re-sync */}
        {!editing &&
          variant.channel === "blog" &&
          canPublish &&
          (variant.status === "approved" ||
            variant.status === "published") && (
            <WpPublishForm
              projectId={variant.project_id}
              variantId={variant.id}
              isUpdate={!!(metadata.wp_post_id as number | undefined)}
              wpPostUrl={(metadata.wp_post_url as string | undefined) ?? null}
            />
          )}

        <NotesThread
          variantId={variant.id}
          notes={notes}
          currentUserId={currentUserId}
          role={role}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Compact attribution line shown under the status pill. Skipped
 * entirely on legacy variants that have neither author nor reviewer
 * so we don't render an empty bar.
 */
function AttributionLine({
  variant,
}: {
  variant: ContentVariantWithPeople;
}) {
  const author = variant.author?.full_name;
  const reviewer = variant.reviewer?.full_name;
  if (!author && !reviewer) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {author && (
        <span className="inline-flex items-center gap-1">
          <UserIcon className="h-3 w-3" />
          <span>
            Autor: <span className="font-medium text-foreground">{author}</span>
          </span>
        </span>
      )}
      {reviewer && (
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-knowon-teal" />
          <span>
            Review:{" "}
            <span className="font-medium text-foreground">{reviewer}</span>
            {variant.reviewed_at && (
              <span className="text-muted-foreground">
                {" · "}
                {formatRelative(variant.reviewed_at)}
              </span>
            )}
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * Internal notes thread for a single variant. Any logged-in team
 * member can add a note; delete is restricted to the note author or
 * an admin. Notes are collapsed behind a header by default to keep
 * the card compact; expand when there are already notes or the user
 * wants to add one.
 */
function NotesThread({
  variantId,
  notes,
  currentUserId,
  role,
}: {
  variantId: string;
  notes: VariantNote[];
  currentUserId: string;
  role: UserRole;
}) {
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    start(async () => {
      const res = await addVariantNote(variantId, draft);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("Notiz hinzugefügt.", "success");
      setDraft("");
    });
  };

  const onDelete = (noteId: string) => {
    if (!confirm("Notiz löschen?")) return;
    start(async () => {
      const res = await deleteVariantNote(noteId);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("Notiz gelöscht.", "success");
    });
  };

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        Interne Notizen
        {notes.length > 0 && (
          <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-foreground">
            {notes.length}
          </span>
        )}
      </div>

      {notes.length > 0 ? (
        <ul className="space-y-2">
          {notes.map((n) => {
            const authorName = n.author?.full_name ?? "Unbekannt";
            const canDelete =
              role === "admin" || n.created_by === currentUserId;
            return (
              <li
                key={n.id}
                className="group rounded-md border bg-background p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="font-semibold text-foreground">
                      {authorName}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      {formatRelative(n.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(role === "admin" || role === "editor") && (
                      <ApplyNoteButton
                        variantId={variantId}
                        noteId={n.id}
                        appliedToVersion={n.applied_to_version}
                        disabled={pending}
                      />
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(n.id)}
                        disabled={pending}
                        aria-label="Notiz löschen"
                        title="Löschen"
                        className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/90">
                  {n.body}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Noch keine Notizen. Nutze das Feld unten, um etwas für das Team zu
          hinterlassen.
        </p>
      )}

      <form onSubmit={submit} className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="z.B. 'Abklären mit Dr. Müller' oder 'Hook passt noch nicht'"
          rows={2}
          className="resize-none text-sm"
          disabled={pending}
          maxLength={2000}
        />
        <div className="flex items-center justify-end gap-2">
          <span className="text-[10px] text-muted-foreground">
            {draft.length}/2000
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={pending || !draft.trim()}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MessageSquare className="h-3.5 w-3.5" />
            )}
            Notiz hinzufügen
          </Button>
        </div>
      </form>
    </div>
  );
}
