import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { buildAuthUrl, isLinkedinConfigured } from "@/lib/linkedin/client";
import crypto from "crypto";

export async function GET(_req: NextRequest) {
  await requireRole("admin");

  if (!isLinkedinConfigured()) {
    return new NextResponse(
      "LinkedIn is not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.",
      { status: 500 },
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const url = buildAuthUrl(state);
  const res = NextResponse.redirect(url);
  // CSRF protection
  res.cookies.set("li_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
