import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabase/server";
import type { Profile, UserRole } from "./supabase/types";

/**
 * Resolve the current user + profile row. Redirects to /login if not authed.
 */
export async function requireUser() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // profile row missing → sign them out and redirect to login
    await supabase.auth.signOut();
    redirect("/login?error=missing_profile");
  }

  return { user, profile: profile as Profile, supabase };
}

export async function requireRole(...roles: UserRole[]) {
  const ctx = await requireUser();
  if (!roles.includes(ctx.profile.role)) {
    redirect("/?error=forbidden");
  }
  return ctx;
}

export function hasRole(profile: Profile | null | undefined, ...roles: UserRole[]) {
  return !!profile && roles.includes(profile.role);
}
