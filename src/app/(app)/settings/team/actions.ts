"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

const VALID_ROLES: UserRole[] = ["admin", "editor", "reviewer"];

/**
 * Create a user directly — no invite, no email. Admin provides the
 * password, the user is immediately usable.
 */
export async function createUser(formData: FormData) {
  await requireRole("admin");

  const email = String(formData.get("email") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "editor") as UserRole;

  if (!email) return { error: "E-Mail ist erforderlich." };
  if (!/^\S+@\S+\.\S+$/.test(email))
    return { error: "Bitte eine gültige E-Mail." };
  if (!password || password.length < 12)
    return { error: "Passwort (mind. 12 Zeichen) erforderlich." };
  if (!VALID_ROLES.includes(role))
    return { error: "Ungültige Rolle." };

  const admin = getSupabaseAdmin();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || null, role },
  });

  if (error) {
    // Supabase auth errors sometimes leak constraint names and
    // schema hints. Log the detail server-side, return a generic
    // message the client can display.
    console.error("[team.createUser] supabase error", error);
    const friendly = /already|exists|duplicate/i.test(error.message)
      ? "Diese E-Mail existiert bereits."
      : "Anlegen fehlgeschlagen.";
    return { error: friendly };
  }

  // Ensure profile row reflects exact values (trigger may race with metadata)
  if (data.user) {
    await admin
      .from("profiles")
      .upsert(
        { id: data.user.id, full_name: fullName || null, role },
        { onConflict: "id" },
      );
  }

  revalidatePath("/settings/team");
  return { ok: true };
}

export async function updateUserRole(userId: string, role: UserRole) {
  await requireRole("admin");
  if (!VALID_ROLES.includes(role)) return { error: "Ungültige Rolle." };

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/settings/team");
  return { ok: true };
}

export async function deleteUser(userId: string) {
  const { user: currentUser } = await requireRole("admin");

  if (userId === currentUser.id) {
    return { error: "Du kannst dich nicht selbst löschen." };
  }

  const admin = getSupabaseAdmin();
  // Cascades via ON DELETE CASCADE on profiles → auth.users
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[team.deleteUser] supabase error", error);
    return { error: "Löschen fehlgeschlagen." };
  }

  revalidatePath("/settings/team");
  return { ok: true };
}

export async function resetUserPassword(userId: string, newPassword: string) {
  await requireRole("admin");
  if (!newPassword || newPassword.length < 12) {
    return { error: "Passwort (mind. 12 Zeichen)." };
  }
  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

// Self-service: user changes their own password
export async function changeOwnPassword(newPassword: string) {
  const { user } = await requireUser();
  if (!newPassword || newPassword.length < 12) {
    return { error: "Passwort (mind. 12 Zeichen)." };
  }
  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function updateOwnName(fullName: string) {
  const { user, supabase } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName || null })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/settings/account");
  return { ok: true };
}
