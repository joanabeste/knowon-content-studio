import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { encryptString } from "@/lib/crypto";
import {
  exchangeCodeForToken,
  findInstagramBusinessId,
} from "@/lib/instagram/client";

export async function GET(req: NextRequest) {
  const { user } = await requireRole("admin");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const errorDescription = req.nextUrl.searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?instagram_error=${encodeURIComponent(errorDescription || error)}`,
        req.url,
      ),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings/integrations?instagram_error=missing_params", req.url),
    );
  }

  const cookieState = req.cookies.get("ig_oauth_state")?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(
      new URL("/settings/integrations?instagram_error=state_mismatch", req.url),
    );
  }

  try {
    const token = await exchangeCodeForToken(code);
    const ig = await findInstagramBusinessId(token.access_token);

    if (!ig) {
      return NextResponse.redirect(
        new URL(
          "/settings/integrations?instagram_error=no_business_account",
          req.url,
        ),
      );
    }

    const admin = getSupabaseAdmin();
    await admin.from("platform_connections").upsert(
      {
        platform: "instagram",
        access_token_encrypted: encryptString(token.access_token),
        refresh_token_encrypted: null,
        expires_at: token.expires_in
          ? new Date(Date.now() + token.expires_in * 1000).toISOString()
          : null,
        external_id: ig.igUserId,
        external_name: ig.pageName,
        scopes: null,
        connected_by: user.id,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "platform" },
    );

    const res = NextResponse.redirect(
      new URL("/settings/integrations?instagram_ok=1", req.url),
    );
    res.cookies.delete("ig_oauth_state");
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?instagram_error=${encodeURIComponent(msg)}`,
        req.url,
      ),
    );
  }
}
