"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { fireBrandConfetti } from "@/lib/confetti";
import {
  CHANNEL_LABELS,
  type Channel,
  type ContentProject,
  type ContentVariantWithPeople,
  type UserRole,
  type VariantStatus,
} from "@/lib/supabase/types";
import {
  approveProject,
  assignProject,
  regenerateVariantsForProject,
  sendProjectToReview,
} from "./actions";

export type ProfileOption = {
  id: string;
  full_name: string | null;
  role: UserRole;
};

type Mode = null | "assign" | "review" | "approve" | "regenerate";

export function ProjectActionsBar({
  project,
  variants,
  profiles,
  assignedProfile,
  currentUserId,
  role,
}: {
  project: ContentProject;
  variants: ContentVariantWithPeople[];
  profiles: ProfileOption[];
  assignedProfile: ProfileOption | null;
  currentUserId: string;
  role: UserRole;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const close = () => setMode(null);

  const canAct = role === "admin" || role === "editor";
  const canApprove = role === "admin" || role === "reviewer" || role === "editor";

  const hasDraft = variants.some((v) => v.status === "draft");
  const hasInReview = variants.some((v) => v.status === "in_review");

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <AssigneePill
          assignedProfile={assignedProfile}
          onClick={() => setMode(mode === "assign" ? null : "assign")}
          disabled={!canAct}
        />
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {hasDraft && canAct && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMode("review")}
            >
              <Send className="h-4 w-4" />
              In Review schicken
            </Button>
          )}
          {hasInReview && canApprove && (
            <Button
              size="sm"
              onClick={() => setMode("approve")}
              className="bg-knowon-teal hover:bg-knowon-teal/90"
            >
              <CheckCircle2 className="h-4 w-4" />
              Projekt freigeben
            </Button>
          )}
          {canAct && variants.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMode("regenerate")}
            >
              <RefreshCw className="h-4 w-4" />
              Alle neu generieren
            </Button>
          )}
        </div>
      </div>

      {mode === "assign" && (
        <AssignPanel
          projectId={project.id}
          profiles={profiles}
          currentAssigneeId={project.assigned_to}
          currentUserId={currentUserId}
          onClose={close}
        />
      )}
      {mode === "review" && (
        <ReviewPanel
          projectId={project.id}
          variants={variants}
          profiles={profiles}
          defaultAssigneeId={project.assigned_to}
          onClose={close}
        />
      )}
      {mode === "approve" && (
        <ApprovePanel
          projectId={project.id}
          variants={variants}
          profiles={profiles}
          defaultAssigneeId={project.assigned_to}
          onClose={close}
        />
      )}
      {mode === "regenerate" && (
        <RegenerateAllPanel
          projectId={project.id}
          variants={variants}
          onClose={close}
        />
      )}
    </div>
  );
}

function initials(name: string | null): string {
  if (!name || !name.trim()) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function AssigneePill({
  assignedProfile,
  onClick,
  disabled,
}: {
  assignedProfile: ProfileOption | null;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-background px-2.5 py-1 text-sm transition",
        !disabled && "hover:border-knowon-teal hover:bg-knowon-teal/5",
        disabled && "cursor-not-allowed opacity-70",
      )}
    >
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-knowon-purple/10 text-[10px] font-semibold text-knowon-purple">
        {assignedProfile ? initials(assignedProfile.full_name) : <UserRound className="h-3.5 w-3.5" />}
      </span>
      <span className="text-xs font-medium">
        <span className="text-muted-foreground">Verantwortlich:</span>{" "}
        {assignedProfile?.full_name ?? "—"}
      </span>
    </button>
  );
}

function AssignPanel({
  projectId,
  profiles,
  currentAssigneeId,
  currentUserId,
  onClose,
}: {
  projectId: string;
  profiles: ProfileOption[];
  currentAssigneeId: string | null;
  currentUserId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string | null>(currentAssigneeId);

  const save = () => {
    start(async () => {
      const res = await assignProject(projectId, selected);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("Zuweisung aktualisiert.", "success");
      onClose();
      router.refresh();
    });
  };

  return (
    <div className="space-y-2 rounded-md border border-dashed bg-muted/20 p-3">
      <Label className="text-xs font-semibold uppercase tracking-wide">
        Verantwortliche Person wählen
      </Label>
      <select
        value={selected ?? ""}
        onChange={(e) => setSelected(e.target.value || null)}
        className="w-full rounded border bg-background px-2 py-1.5 text-sm"
      >
        <option value="">— niemand —</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name ?? "(ohne Name)"} · {roleLabel(p.role)}
            {p.id === currentUserId ? " (ich)" : ""}
          </option>
        ))}
      </select>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose} disabled={pending}>
          Abbrechen
        </Button>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Speichern
        </Button>
      </div>
    </div>
  );
}

function ReviewPanel({
  projectId,
  variants,
  profiles,
  defaultAssigneeId,
  onClose,
}: {
  projectId: string;
  variants: ContentVariantWithPeople[];
  profiles: ProfileOption[];
  defaultAssigneeId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const draftChannels = variants
    .filter((v) => v.status === "draft")
    .map((v) => v.channel);
  const lockedChannels = variants
    .filter((v) => v.status !== "draft")
    .map((v) => ({ channel: v.channel, status: v.status }));

  const [checked, setChecked] = useState<Record<Channel, boolean>>(() =>
    Object.fromEntries(draftChannels.map((c) => [c, true])) as Record<
      Channel,
      boolean
    >,
  );
  const [assigneeId, setAssigneeId] = useState<string | null>(
    defaultAssigneeId,
  );

  const toggle = (c: Channel) =>
    setChecked((prev) => ({ ...prev, [c]: !prev[c] }));

  const selected = draftChannels.filter((c) => checked[c]);

  const submit = () => {
    if (selected.length === 0) {
      toast.show("Mindestens einen Kanal auswählen.", "error");
      return;
    }
    start(async () => {
      const res = await sendProjectToReview(projectId, {
        channels: selected,
        assigneeId,
      });
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show(`${res.count} Kanal/Kanäle zur Review geschickt.`, "success");
      onClose();
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-md border border-dashed bg-muted/20 p-3">
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wide">
          Kanäle zur Review schicken
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Nur Entwürfe können jetzt zur Review. Bereits freigegebene/veröffentlichte
          Kanäle bleiben unangetastet.
        </p>
      </div>
      <div className="space-y-1">
        {draftChannels.length === 0 && (
          <p className="text-xs italic text-muted-foreground">
            Keine Entwurfs-Kanäle vorhanden.
          </p>
        )}
        {draftChannels.map((c) => (
          <label
            key={c}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-background"
          >
            <input
              type="checkbox"
              checked={!!checked[c]}
              onChange={() => toggle(c)}
              className="h-4 w-4 rounded border-input"
            />
            <span className="text-sm">{CHANNEL_LABELS[c]}</span>
          </label>
        ))}
        {lockedChannels.map(({ channel, status }) => (
          <div
            key={channel}
            className="flex items-center gap-2 rounded px-2 py-1 opacity-50"
          >
            <input
              type="checkbox"
              disabled
              className="h-4 w-4 rounded border-input"
            />
            <span className="text-sm line-through">
              {CHANNEL_LABELS[channel]}
            </span>
            <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
              {statusLabel(status)}
            </span>
          </div>
        ))}
      </div>

      <AssigneeSelect
        profiles={profiles}
        value={assigneeId}
        onChange={setAssigneeId}
        label="Reviewer zuweisen (optional)"
      />

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose} disabled={pending}>
          Abbrechen
        </Button>
        <Button size="sm" onClick={submit} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {selected.length === 0
            ? "Zur Review"
            : `${selected.length} zur Review schicken`}
        </Button>
      </div>
    </div>
  );
}

function ApprovePanel({
  projectId,
  variants,
  profiles,
  defaultAssigneeId,
  onClose,
}: {
  projectId: string;
  variants: ContentVariantWithPeople[];
  profiles: ProfileOption[];
  defaultAssigneeId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [assigneeId, setAssigneeId] = useState<string | null>(
    defaultAssigneeId,
  );

  const inReview = variants.filter((v) => v.status === "in_review");

  const submit = () => {
    start(async () => {
      const res = await approveProject(projectId, { assigneeId });
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show(`${res.count} Kanal/Kanäle freigegeben.`, "success");
      // Celebrate — a small brand-colored confetti burst makes the
      // moment feel like an accomplishment rather than a form-submit.
      void fireBrandConfetti();
      onClose();
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-md border border-dashed bg-knowon-teal/5 p-3">
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wide">
          Projekt freigeben
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Folgende {inReview.length} Kanal/Kanäle werden auf „freigegeben"
          gesetzt:
        </p>
      </div>
      <ul className="space-y-1 text-sm">
        {inReview.map((v) => (
          <li key={v.id} className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-knowon-teal" />
            {CHANNEL_LABELS[v.channel]}
          </li>
        ))}
      </ul>

      <AssigneeSelect
        profiles={profiles}
        value={assigneeId}
        onChange={setAssigneeId}
        label="Nächste verantwortliche Person (optional)"
      />

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose} disabled={pending}>
          Abbrechen
        </Button>
        <Button size="sm" onClick={submit} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Freigeben
        </Button>
      </div>
    </div>
  );
}

function RegenerateAllPanel({
  projectId,
  variants,
  onClose,
}: {
  projectId: string;
  variants: ContentVariantWithPeople[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const allChannels = variants.map((v) => v.channel);
  const [checked, setChecked] = useState<Record<Channel, boolean>>(() =>
    Object.fromEntries(allChannels.map((c) => [c, true])) as Record<
      Channel,
      boolean
    >,
  );
  const [extraPrompt, setExtraPrompt] = useState("");

  const selected = allChannels.filter((c) => checked[c]);

  const submit = () => {
    if (selected.length === 0) {
      toast.show("Mindestens einen Kanal auswählen.", "error");
      return;
    }
    start(async () => {
      const res = await regenerateVariantsForProject(projectId, {
        channels: selected,
        extraPrompt: extraPrompt || null,
      });
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show(`${res.count} Kanal/Kanäle neu generiert.`, "success");
      onClose();
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-md border border-dashed bg-muted/20 p-3">
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wide">
          Ausgewählte Kanäle neu generieren
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Die alten Versionen werden in der Historie archiviert und sind
          pro Kanal wieder abrufbar.
        </p>
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {allChannels.map((c) => (
          <label
            key={c}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-background"
          >
            <input
              type="checkbox"
              checked={!!checked[c]}
              onChange={() =>
                setChecked((prev) => ({ ...prev, [c]: !prev[c] }))
              }
              className="h-4 w-4 rounded border-input"
            />
            <span className="text-sm">{CHANNEL_LABELS[c]}</span>
          </label>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Zusätzliche Anweisung (optional)</Label>
        <Textarea
          rows={2}
          value={extraPrompt}
          onChange={(e) => setExtraPrompt(e.target.value)}
          placeholder={'z.B. „Datum weglassen", „weniger Emojis"…'}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose} disabled={pending}>
          Abbrechen
        </Button>
        <Button size="sm" onClick={submit} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Neu generieren
        </Button>
      </div>
    </div>
  );
}

function AssigneeSelect({
  profiles,
  value,
  onChange,
  label,
}: {
  profiles: ProfileOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded border bg-background px-2 py-1.5 text-sm"
      >
        <option value="">— niemand —</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name ?? "(ohne Name)"} · {roleLabel(p.role)}
          </option>
        ))}
      </select>
    </div>
  );
}

function roleLabel(r: UserRole): string {
  return r === "admin" ? "Admin" : r === "editor" ? "Editor" : "Reviewer";
}

function statusLabel(s: VariantStatus): string {
  return s === "draft"
    ? "Entwurf"
    : s === "in_review"
      ? "In Review"
      : s === "approved"
        ? "Freigegeben"
        : "Veröffentlicht";
}
