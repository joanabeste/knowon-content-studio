"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { renameProject } from "./actions";

export function EditableProjectTitle({
  projectId,
  initialTopic,
  canEdit,
}: {
  projectId: string;
  initialTopic: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialTopic);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialTopic);
  }, [initialTopic]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const next = value.trim();
    if (!next) {
      toast.show("Titel darf nicht leer sein.", "error");
      setValue(initialTopic);
      setEditing(false);
      return;
    }
    if (next === initialTopic) {
      setEditing(false);
      return;
    }
    start(async () => {
      const res = await renameProject(projectId, next);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        setValue(initialTopic);
        setEditing(false);
        return;
      }
      toast.show("Titel aktualisiert.", "success");
      setEditing(false);
      router.refresh();
    });
  };

  const cancel = () => {
    setValue(initialTopic);
    setEditing(false);
  };

  if (!canEdit) {
    return (
      <h1 className="text-3xl font-bold leading-tight">{initialTopic}</h1>
    );
  }

  if (editing) {
    return (
      <div className="flex flex-1 items-center gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          disabled={pending}
          maxLength={200}
          className="w-full rounded-md border bg-background px-2 py-1 text-3xl font-bold leading-tight outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          aria-label="Projekttitel bearbeiten"
        />
        {pending && (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "group flex flex-1 items-center gap-2 rounded-md text-left",
        "hover:bg-muted/40",
      )}
      title="Titel bearbeiten"
    >
      <h1 className="text-3xl font-bold leading-tight">{initialTopic}</h1>
      <Pencil className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
