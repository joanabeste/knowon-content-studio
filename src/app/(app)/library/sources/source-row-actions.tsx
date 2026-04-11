"use client";

import { useTransition } from "react";
import { Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { toggleFeatured, deleteSourcePost } from "./actions";

export function SourceRowActions({
  id,
  isFeatured,
  canEdit,
  canDelete,
}: {
  id: string;
  isFeatured: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  const onToggle = () => {
    start(async () => {
      const res = await toggleFeatured(id);
      if ("error" in res && res.error) toast.show(res.error, "error");
    });
  };

  const onDelete = () => {
    if (!confirm("Diesen Eintrag wirklich löschen?")) return;
    start(async () => {
      const res = await deleteSourcePost(id);
      if ("error" in res && res.error) toast.show(res.error, "error");
      else toast.show("Gelöscht.", "success");
    });
  };

  return (
    <div className="flex items-center gap-1">
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          disabled={pending}
          title={isFeatured ? "Featured entfernen" : "Als Featured markieren"}
        >
          <Star
            className={
              isFeatured
                ? "h-4 w-4 fill-knowon-pink text-knowon-pink"
                : "h-4 w-4 text-muted-foreground"
            }
          />
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={pending}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}
