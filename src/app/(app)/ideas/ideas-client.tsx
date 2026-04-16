"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn, formatRelative } from "@/lib/utils";
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  type Channel,
  type ProjectIdea,
  type UserRole,
} from "@/lib/supabase/types";
import {
  archiveIdea,
  convertIdeaToProject,
  createIdea,
  deleteIdea,
  updateIdea,
} from "./actions";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function IdeasClient({
  active,
  archived,
  currentUserId,
  role,
}: {
  active: ProjectIdea[];
  archived: ProjectIdea[];
  currentUserId: string;
  role: UserRole;
}) {
  const canEdit = role !== "reviewer";
  const [showArchived, setShowArchived] = useState(false);

  return (
    <div className="space-y-6">
      {canEdit && <QuickAddForm />}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Aktive Ideen ({active.length})
        </h2>
        {active.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <Lightbulb className="h-6 w-6" />
              <p>Noch keine Ideen. Starte oben mit der ersten.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {active.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                currentUserId={currentUserId}
                role={role}
              />
            ))}
          </div>
        )}
      </section>

      {archived.length > 0 && (
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            {showArchived ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            Archiviert ({archived.length})
          </button>
          {showArchived && (
            <div className="grid gap-3 opacity-70">
              {archived.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  currentUserId={currentUserId}
                  role={role}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function QuickAddForm() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);

  const reset = () => {
    setTitle("");
    setNotes("");
    setTargetDate("");
    setChannels([]);
    setExpanded(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.show("Titel fehlt.", "error");
      return;
    }
    const fd = new FormData();
    fd.set("title", title);
    if (notes) fd.set("notes", notes);
    if (targetDate) fd.set("target_date", targetDate);
    for (const c of channels) fd.append("suggested_channels", c);
    start(async () => {
      const res = await createIdea(fd);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("Idee gespeichert.", "success");
      reset();
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-knowon-pink" />
          Neue Idee
        </CardTitle>
        {!expanded && (
          <CardDescription>
            Titel reicht — Details kannst du später ergänzen.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="idea-title">Titel</Label>
            <Input
              id="idea-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Worum geht's?"
              disabled={pending}
            />
          </div>

          {!expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Details ergänzen (optional)
            </button>
          )}

          {expanded && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="idea-notes">
                  Notizen / Briefing
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    optional
                  </span>
                </Label>
                <Textarea
                  id="idea-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Kernbotschaft, Zielgruppe, Fakten, …"
                  disabled={pending}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="idea-date">
                    Ziel-Datum
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      optional
                    </span>
                  </Label>
                  <Input
                    id="idea-date"
                    type="datetime-local"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    disabled={pending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Angedachte Kanäle
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      optional
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_CHANNELS.map((c) => {
                      const active = channels.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            setChannels((prev) =>
                              active
                                ? prev.filter((x) => x !== c)
                                : [...prev, c],
                            )
                          }
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-xs transition",
                            active
                              ? "border-knowon-teal bg-knowon-teal text-white"
                              : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                          )}
                        >
                          {CHANNEL_LABELS[c]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Idee speichern
            </Button>
            {expanded && (
              <Button
                type="button"
                variant="ghost"
                onClick={reset}
                disabled={pending}
              >
                Abbrechen
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function IdeaCard({
  idea,
  currentUserId,
  role,
}: {
  idea: ProjectIdea;
  currentUserId: string;
  role: UserRole;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const canEdit = role !== "reviewer";
  const canDelete = role === "admin" || idea.created_by === currentUserId;

  const convert = () => {
    start(async () => {
      const res = await convertIdeaToProject(idea.id);
      if (res && "error" in res && res.error) {
        toast.show(res.error, "error");
      }
    });
  };

  const onDelete = () => {
    if (!confirm("Idee wirklich löschen?")) return;
    start(async () => {
      const res = await deleteIdea(idea.id);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("Idee gelöscht.", "success");
      router.refresh();
    });
  };

  const onArchive = () => {
    const archive = idea.archived_at === null;
    start(async () => {
      const res = await archiveIdea(idea.id, archive);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show(archive ? "Archiviert." : "Wiederhergestellt.", "success");
      router.refresh();
    });
  };

  if (editing && canEdit) {
    return <IdeaEditForm idea={idea} onDone={() => setEditing(false)} />;
  }

  const authorName = idea.author?.full_name ?? "Unbekannt";
  const isConverted = idea.converted_to_project_id !== null;

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{idea.title}</h3>
              {isConverted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-knowon-teal/15 px-2 py-0.5 text-[10px] font-semibold text-knowon-teal">
                  <Check className="h-3 w-3" />
                  Projekt angelegt
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {authorName} · {formatRelative(idea.created_at)}
              {idea.target_date && (
                <>
                  <span className="mx-1.5">·</span>
                  <CalendarClock className="mr-1 inline h-3 w-3" />
                  Ziel {formatRelative(idea.target_date)}
                </>
              )}
            </div>
          </div>
        </div>

        {idea.notes && (
          <p className="whitespace-pre-wrap text-sm text-foreground/90">
            {idea.notes}
          </p>
        )}

        {idea.suggested_channels && idea.suggested_channels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {idea.suggested_channels.map((c) => (
              <span
                key={c}
                className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {CHANNEL_LABELS[c]}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {!isConverted && canEdit && (
            <Button size="sm" onClick={convert} disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              In Projekt umwandeln
            </Button>
          )}
          {isConverted && idea.converted_to_project_id && (
            <Link
              href={`/projects/${idea.converted_to_project_id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-knowon-teal hover:text-knowon-teal"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Zum Projekt
            </Link>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              disabled={pending}
            >
              <Pencil className="h-4 w-4" />
              Bearbeiten
            </Button>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={onArchive}
              disabled={pending}
            >
              {idea.archived_at ? (
                <>
                  <ArchiveRestore className="h-4 w-4" />
                  Wiederherstellen
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" />
                  Archivieren
                </>
              )}
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              disabled={pending}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function IdeaEditForm({
  idea,
  onDone,
}: {
  idea: ProjectIdea;
  onDone: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(idea.title);
  const [notes, setNotes] = useState(idea.notes ?? "");
  const [targetDate, setTargetDate] = useState(
    toLocalInputValue(idea.target_date),
  );
  const [channels, setChannels] = useState<Channel[]>(
    idea.suggested_channels ?? [],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.show("Titel fehlt.", "error");
      return;
    }
    const fd = new FormData();
    fd.set("title", title);
    if (notes) fd.set("notes", notes);
    if (targetDate) fd.set("target_date", targetDate);
    for (const c of channels) fd.append("suggested_channels", c);
    start(async () => {
      const res = await updateIdea(idea.id, fd);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("Gespeichert.", "success");
      onDone();
      router.refresh();
    });
  };

  return (
    <Card>
      <CardContent className="py-4">
        <form onSubmit={submit} className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={pending}
          />
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notizen"
            disabled={pending}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="datetime-local"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              disabled={pending}
            />
            <div className="flex flex-wrap gap-1.5">
              {ALL_CHANNELS.map((c) => {
                const active = channels.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setChannels((prev) =>
                        active ? prev.filter((x) => x !== c) : [...prev, c],
                      )
                    }
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs transition",
                      active
                        ? "border-knowon-teal bg-knowon-teal text-white"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {CHANNEL_LABELS[c]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Speichern
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onDone}
              disabled={pending}
            >
              Abbrechen
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
