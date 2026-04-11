"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteProject } from "./actions";

export function DeleteProjectButton({
  projectId,
  topic,
}: {
  projectId: string;
  topic: string;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  const onClick = () => {
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

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={onClick}
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
    >
      <Trash2 className="h-4 w-4" />
      Löschen
    </Button>
  );
}
