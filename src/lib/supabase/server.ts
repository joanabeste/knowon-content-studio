import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";

/**
 * Supabase client for use inside Server Components, Server Actions and Route Handlers.
 * Reads the authed user from the request cookies.
 */
export async function getSupabaseServer() {
  const env = serverEnv();
  const cookieStore = await cookies();
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>,
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `set` throws inside Server Components — safe to ignore as middleware
            // refreshes the session.
          }
        },
      },
    },
  );
}

/**
 * Admin client (service role). Bypasses RLS — ONLY use in server actions that
 * have already verified the caller is an admin.
 */
export function getSupabaseAdmin() {
  const env = serverEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
