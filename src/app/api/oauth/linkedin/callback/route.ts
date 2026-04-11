import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { encryptString } from "@/lib/crypto";
import { exchangeCodeForToken, fetchProfile } from "@/lib/linkedin/client";

export async function GET(req: NextRequest) {
  const { user } = await requireRole("admin");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const errorDescription = req.nextUrl.searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?linkedin_error=${encodeURIComponent(errorDescription || error)}`,
        req.url,
      ),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings/integrations?linkedin_error=missing_params", req.url),
    );
  }

  const cookieState = req.cookies.get("li_oauth_state")?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(
      new URL("/settings/integrations?linkedin_error=state_mismatch", req.url),
    );
  }

  try {
    const token = await exchangeCodeForToken(code);
    const profile = await fetchProfile(token.access_token);

    const displayName = [profile.localizedFirstName, profile.localizedLastName]
      .filter(Boolean)
      .join(" ")
      .trim() || profile.id;

    const admin = getSupabaseAdmin();
    await admin.from("platform_connections").upsert(
      {
        platform: "linkedin",
        access_token_encrypted: encryptString(token.access_token),
        refresh_token_encrypted: token.refresh_token
          ? encryptString(token.refresh_token)
          : null,
        expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
        external_id: profile.id,
        external_name: displayName,
        scopes: token.scope ? token.scope.split(/\s+/) : null,
        connected_by: user.id,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "platform" },
    );

    const res = NextResponse.redirect(
      new URL("/settings/integrations?linkedin_ok=1", req.url),
    );
    res.cookies.delete("li_oauth_state");
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?linkedin_error=${encodeURIComponent(msg)}`,
        req.url,
      ),
    );
  }
}
