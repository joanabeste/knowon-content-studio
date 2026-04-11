"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteProject } from "./actions";

export function DeleteProjectButton({
  projectId,
  topic,
  iconOnly = false,
}: {
  projectId: string;
  topic: string;
  iconOnly?: boolean;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      !confirm(
        `Projekt "${topic}" inklusive aller Varianten und Bilder wirklich löschen?`,
      )
    ) {
      return;
    }
    start(async () => {
      const res = await deleteProject(projectId);
      if (res && "error" in res && res.error) {
        toast.show(res.error, "error");
      }
      // on success the action redirects
    });
  };

  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled={pending}
        onClick={onClick}
        className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        title={`Projekt "${topic}" löschen`}
        aria-label="Projekt löschen"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={onClick}
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
      Löschen
    </Button>
  );
}
