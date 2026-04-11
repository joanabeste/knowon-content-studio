import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * unauthenticated users away from `(app)` routes to /login.
 *
 * Defensive: if required env vars are missing (e.g. mis-configured
 * Vercel deployment) the middleware returns next() instead of crashing
 * with MIDDLEWARE_INVOCATION_FAILED. The user still sees the app shell
 * and a clear config error in the page content rather than a 500.
 */
export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Hard fail-safe: env vars missing → just pass through
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "[middleware] Supabase env vars missing — passing request through unauthenticated.",
      {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        path: request.nextUrl.pathname,
      },
    );
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: CookieOptions;
          }>,
        ) {
          cookiesToSet.forEach(
            ({ name, value }: { name: string; value: string }) =>
              request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(
            ({
              name,
              value,
              options,
            }: {
              name: string;
              value: string;
              options?: CookieOptions;
            }) => response.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;
    const isPublic =
      pathname === "/login" ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/_next") ||
      pathname === "/favicon.ico";

    if (!user && !isPublic) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    if (user && pathname === "/login") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  } catch (err) {
    // Any unexpected error: log and pass through. Better a partially
    // broken app than a 500.
    console.error("[middleware] unexpected error, passing through:", err);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
