import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { requireRole } from "@/lib/auth";
import { buildAuthUrl, isMetaConfigured } from "@/lib/instagram/client";

export async function GET(_req: NextRequest) {
  await requireRole("admin");

  if (!isMetaConfigured()) {
    return new NextResponse(
      "Meta is not configured. Set META_CLIENT_ID and META_CLIENT_SECRET.",
      { status: 500 },
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const url = buildAuthUrl(state);
  const res = NextResponse.redirect(url);
  res.cookies.set("ig_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
