"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteExample } from "./actions";

export function DeleteExampleButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      onClick={() => {
        if (!confirm("Beispiel wirklich löschen?")) return;
        start(async () => {
          await deleteExample(id);
        });
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
