"use client";

import { useTransition } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { ContextDocument } from "@/lib/supabase/types";
import { toggleDocumentActive, deleteDocument } from "./actions";

export function DocumentActions({
  doc,
  canEdit,
}: {
  doc: ContextDocument;
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  if (!canEdit) return null;

  const onToggle = () => {
    start(async () => {
      const res = await toggleDocumentActive(doc.id);
      if ("error" in res && res.error) toast.show(res.error, "error");
    });
  };

  const onDelete = () => {
    if (!confirm(`Dokument "${doc.title}" löschen?`)) return;
    start(async () => {
      const res = await deleteDocument(doc.id);
      if ("error" in res && res.error) toast.show(res.error, "error");
      else toast.show("Gelöscht.", "success");
    });
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        disabled={pending}
        title={doc.is_active ? "Deaktivieren" : "Aktivieren"}
      >
        {doc.is_active ? (
          <Eye className="h-4 w-4" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        disabled={pending}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
