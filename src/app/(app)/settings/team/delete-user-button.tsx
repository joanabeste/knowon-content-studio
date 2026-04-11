"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteUser } from "./actions";

export function DeleteUserButton({
  userId,
  userName,
  disabled,
}: {
  userId: string;
  userName: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  const onClick = () => {
    if (disabled) return;
    if (
      !confirm(
        `Nutzer "${userName}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`,
      )
    ) {
      return;
    }
    start(async () => {
      const res = await deleteUser(userId);
      if ("error" in res && res.error) toast.show(res.error, "error");
      else toast.show("Nutzer gelöscht.", "success");
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={disabled || pending}
      onClick={onClick}
      title={disabled ? "Du kannst dich nicht selbst löschen" : "Löschen"}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
