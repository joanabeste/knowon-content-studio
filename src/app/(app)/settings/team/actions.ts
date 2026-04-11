"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

export async function inviteUser(formData: FormData) {
  await requireRole("admin");

  const email = String(formData.get("email") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();
  const role = (String(formData.get("role") || "editor") as UserRole);

  if (!email) return { error: "E-Mail ist erforderlich." };
  if (!["admin", "editor", "reviewer"].includes(role))
    return { error: "Ungültige Rolle." };

  const admin = getSupabaseAdmin();
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/set-password`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role },
    redirectTo,
  });

  if (error) return { error: error.message };

  // The handle_new_user trigger creates the profile row. We make sure role/name match.
  if (data.user) {
    await admin
      .from("profiles")
      .update({ full_name: fullName || null, role })
      .eq("id", data.user.id);
  }

  revalidatePath("/settings/team");
  return { ok: true };
}

export async function updateUserRole(userId: string, role: UserRole) {
  await requireRole("admin");

  if (!["admin", "editor", "reviewer"].includes(role)) {
    return { error: "Ungültige Rolle." };
  }
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/settings/team");
  return { ok: true };
}
