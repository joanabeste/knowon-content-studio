"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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

type Sort = "new" | "old" | "target";
type StatusFilter = "all" | "open" | "done";

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

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("new");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [channelFilter, setChannelFilter] = useState<Channel | null>(null);

  const convertedCount = active.filter(
    (i) => i.converted_to_project_id !== null,
  ).length;
  const openCount = active.length - convertedCount;

  const filtered = useMemo(() => {
    let rows = active;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.notes ?? "").toLowerCase().includes(q),
      );
    }
    if (statusFilter === "open") {
      rows = rows.filter((i) => i.converted_to_project_id === null);
    } else if (statusFilter === "done") {
      rows = rows.filter((i) => i.converted_to_project_id !== null);
    }
    if (channelFilter) {
      rows = rows.filter(
        (i) => i.suggested_channels?.includes(channelFilter) ?? false,
      );
    }
    const sorted = [...rows];
    if (sort === "new") {
      sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    } else if (sort === "old") {
      sorted.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    } else {
      // target — ideas with a target date first, soonest first, rest last
      sorted.sort((a, b) => {
        if (a.target_date && b.target_date) {
          return (
            new Date(a.target_date).getTime() -
            new Date(b.target_date).getTime()
          );
        }
        if (a.target_date) return -1;
        if (b.target_date) return 1;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
    }
    return sorted;
  }, [active, query, sort, statusFilter, channelFilter]);

  const activeFilters =
    (query ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (channelFilter ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <StatPill
          icon={<Lightbulb className="h-3 w-3" />}
          label="Aktiv"
          value={active.length}
          tone="pink"
        />
        <StatPill
          icon={<Sparkles className="h-3 w-3" />}
          label="Offen"
          value={openCount}
          tone="muted"
        />
        <StatPill
          icon={<CheckCircle2 className="h-3 w-3" />}
          label="Umgesetzt"
          value={convertedCount}
          tone="teal"
        />
        {archived.length > 0 && (
          <StatPill
            icon={<Archive className="h-3 w-3" />}
            label="Archiviert"
            value={archived.length}
            tone="muted"
          />
        )}
      </div>

      {canEdit && <QuickAddForm />}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Titel oder Notizen durchsuchen…"
            className="h-8 pl-7 pr-7 text-xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Suche leeren"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs">
          <SegmentedBtn
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          >
            Alle
          </SegmentedBtn>
          <SegmentedBtn
            active={statusFilter === "open"}
            onClick={() => setStatusFilter("open")}
          >
            Offen
          </SegmentedBtn>
          <SegmentedBtn
            active={statusFilter === "done"}
            onClick={() => setStatusFilter("done")}
          >
            Umgesetzt
          </SegmentedBtn>
        </div>

        <select
          value={channelFilter ?? ""}
          onChange={(e) => setChannelFilter((e.target.value || null) as Channel | null)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
          aria-label="Kanal filtern"
        >
          <option value="">Alle Kanäle</option>
          {ALL_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
          aria-label="Sortierung"
        >
          <option value="new">Neueste zuerst</option>
          <option value="old">Älteste zuerst</option>
          <option value="target">Nach Ziel-Datum</option>
        </select>

        {activeFilters > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
              setChannelFilter(null);
            }}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            zurücksetzen
          </button>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Lightbulb className="h-6 w-6" />
            <p>
              {active.length === 0
                ? "Noch keine Ideen. Starte oben mit der ersten."
                : "Keine Ideen treffen auf deine Filter zu."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              currentUserId={currentUserId}
              role={role}
            />
          ))}
        </div>
      )}

      {/* Archive drawer */}
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
            <div className="grid gap-3 opacity-70 md:grid-cols-2 xl:grid-cols-3">
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

// --------------------------------------------------------------------
// Quick Add
// --------------------------------------------------------------------

function QuickAddForm() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [focused, setFocused] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);

  const expanded = focused || title.length > 0;

  const reset = () => {
    setTitle("");
    setNotes("");
    setTargetDate("");
    setChannels([]);
    setFocused(false);
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
    <form
      onSubmit={submit}
      className={cn(
        "rounded-lg border-2 border-dashed bg-card p-4 transition-all",
        expanded
          ? "border-knowon-pink/50 border-solid shadow-sm"
          : "border-knowon-pink/30 hover:border-knowon-pink/50",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-knowon-pink" />
        <span className="text-sm font-semibold">Neue Idee</span>
        <span className="text-xs text-muted-foreground">
          — Titel eingeben, dann Enter oder „Hinzufügen"
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="z.B. Neuer Online-Kurs Glaukom-Diagnostik"
          className="h-10 text-sm"
          disabled={pending}
        />
        <Button
          type="submit"
          size="default"
          disabled={pending || !title.trim()}
          className="shrink-0"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Hinzufügen
        </Button>
        {expanded && (
          <Button
            type="button"
            size="default"
            variant="ghost"
            onClick={reset}
            disabled={pending}
            className="shrink-0"
            aria-label="Abbrechen"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 space-y-2 border-t pt-2">
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notizen (optional) — Kernbotschaft, Fakten, Zielgruppe…"
            disabled={pending}
            className="text-xs"
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              Ziel
              <input
                type="datetime-local"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                disabled={pending}
                className="rounded border bg-background px-1.5 py-0.5 text-xs"
              />
            </label>
            <div className="flex flex-wrap gap-1">
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
                      "rounded-full border px-2 py-0.5 text-[11px] transition",
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
      )}
    </form>
  );
}

// --------------------------------------------------------------------
// Idea Card
// --------------------------------------------------------------------

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
  const [menuOpen, setMenuOpen] = useState(false);
  const canEdit = role !== "reviewer";
  const canDelete = role === "admin" || idea.created_by === currentUserId;

  if (editing && canEdit) {
    return <IdeaEditForm idea={idea} onDone={() => setEditing(false)} />;
  }

  const convert = () => {
    start(async () => {
      const res = await convertIdeaToProject(idea.id);
      if (res && "error" in res && res.error) {
        toast.show(res.error, "error");
      }
    });
  };

  const onDelete = () => {
    setMenuOpen(false);
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
    setMenuOpen(false);
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

  const authorName = idea.author?.full_name ?? "Unbekannt";
  const isConverted = idea.converted_to_project_id !== null;

  return (
    <Card
      className={cn(
        "group relative flex flex-col transition-shadow hover:shadow-md",
        isConverted && "border-knowon-teal/30 bg-knowon-teal/[0.03]",
      )}
    >
      <CardContent className="flex flex-1 flex-col gap-2 p-3">
        {/* Header: title + converted badge */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 flex-1 text-sm font-semibold leading-snug">
            {idea.title}
          </h3>
          {isConverted && (
            <span
              title="Projekt wurde angelegt"
              className="shrink-0 rounded-full bg-knowon-teal/15 px-1.5 py-0.5 text-[10px] font-semibold text-knowon-teal"
            >
              ✓
            </span>
          )}
        </div>

        {/* Notes — truncated, only if present */}
        {idea.notes && (
          <p className="line-clamp-3 text-xs text-muted-foreground">
            {idea.notes}
          </p>
        )}

        {/* Channels */}
        {idea.suggested_channels && idea.suggested_channels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {idea.suggested_channels.map((c) => (
              <span
                key={c}
                className="rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {CHANNEL_LABELS[c]}
              </span>
            ))}
          </div>
        )}

        {/* Footer: meta + actions */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2">
          <div className="min-w-0 flex-1 text-[10px] text-muted-foreground">
            <div className="truncate">{authorName}</div>
            <div className="flex items-center gap-1.5">
              <span>{formatRelative(idea.created_at)}</span>
              {idea.target_date && (
                <>
                  <span>·</span>
                  <CalendarClock className="h-2.5 w-2.5" />
                  <span>{formatRelative(idea.target_date)}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {!isConverted && canEdit && (
              <Button
                size="sm"
                onClick={convert}
                disabled={pending}
                className="h-7 gap-1 px-2 text-xs"
              >
                {pending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Projekt
                <ArrowRight className="h-3 w-3" />
              </Button>
            )}
            {isConverted && idea.converted_to_project_id && (
              <Link
                href={`/projects/${idea.converted_to_project_id}`}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:border-knowon-teal hover:text-knowon-teal"
              >
                Öffnen
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}

            {canEdit && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Weitere Aktionen"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Menü schließen"
                      className="fixed inset-0 z-30"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-8 z-40 min-w-[10rem] rounded-md border bg-card p-1 shadow-md">
                      <MenuItem
                        icon={<Pencil className="h-3.5 w-3.5" />}
                        label="Bearbeiten"
                        onClick={() => {
                          setMenuOpen(false);
                          setEditing(true);
                        }}
                      />
                      <MenuItem
                        icon={
                          idea.archived_at ? (
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )
                        }
                        label={
                          idea.archived_at
                            ? "Wiederherstellen"
                            : "Archivieren"
                        }
                        onClick={onArchive}
                      />
                      {canDelete && (
                        <MenuItem
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          label="Löschen"
                          onClick={onDelete}
                          tone="destructive"
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------------------
// Edit form (inline replacement of card)
// --------------------------------------------------------------------

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
    <Card className="border-knowon-pink/30">
      <CardContent className="py-3">
        <form onSubmit={submit} className="space-y-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={pending}
            className="text-sm font-semibold"
          />
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notizen"
            disabled={pending}
            className="text-xs"
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            <label className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              <input
                type="datetime-local"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                disabled={pending}
                className="rounded border bg-background px-1.5 py-0.5 text-xs"
              />
            </label>
            <div className="flex flex-wrap gap-1">
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
                      "rounded-full border px-2 py-0.5 text-[11px] transition",
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
          <div className="flex gap-1.5 pt-1">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Speichern
            </Button>
            <Button
              type="button"
              size="sm"
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

// --------------------------------------------------------------------
// Tiny building blocks
// --------------------------------------------------------------------

function StatPill({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "pink" | "teal" | "muted";
}) {
  const toneMap = {
    pink: "bg-knowon-pink/10 text-knowon-pink",
    teal: "bg-knowon-teal/10 text-knowon-teal",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        toneMap[tone],
      )}
    >
      {icon}
      <span>
        <span className="font-semibold">{value}</span>{" "}
        <span className="opacity-80">{label}</span>
      </span>
    </span>
  );
}

function SegmentedBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2 py-1 transition-colors",
        active
          ? "bg-knowon-teal text-white"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "destructive";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
        tone === "destructive"
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
