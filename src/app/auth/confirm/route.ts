import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Handles Supabase email confirmation links (magic link, invite,
 * signup confirmation, email-change, password recovery).
 *
 * The default Supabase email templates render a URL of the form
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 *
 * which arrives here. We exchange the token_hash for a session via
 * verifyOtp and set the session cookies through the SSR client. On
 * success we redirect to the requested `next` path (or /dashboard)
 * so the user lands authenticated.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL("/login?error=missing_token", request.url),
    );
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    console.error("[auth/confirm] verifyOtp failed:", error);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error.message)}`,
        request.url,
      ),
    );
  }

  // Safe-redirect: only accept on-site absolute paths. Reject full
  // URLs AND protocol-relative strings like `//evil.com` (which
  // start with `/` but navigate off-site) and `/\\evil.com` variants.
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
      ? next
      : "/dashboard";
  return NextResponse.redirect(new URL(safeNext, request.url));
}
