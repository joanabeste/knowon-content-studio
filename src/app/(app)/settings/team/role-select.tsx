"use client";

import { useTransition } from "react";
import { updateUserRole } from "./actions";
import type { UserRole } from "@/lib/supabase/types";

export function RoleSelect({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: UserRole;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={currentRole}
      disabled={pending}
      onChange={(e) => {
        const newRole = e.target.value as UserRole;
        start(async () => {
          await updateUserRole(userId, newRole);
        });
      }}
      className="h-9 rounded-md border border-input bg-background px-2 text-sm capitalize"
    >
      <option value="admin">Admin</option>
      <option value="editor">Editor</option>
      <option value="reviewer">Reviewer</option>
    </select>
  );
}
