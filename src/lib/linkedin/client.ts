/**
 * Minimal LinkedIn API client for OAuth + reading authenticated user's
 * own posts via /rest/posts. Uses the Sign-In + Share scopes which do
 * NOT require Marketing Developer Platform review.
 */

export const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
export const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
export const LINKEDIN_API_BASE = "https://api.linkedin.com";
export const LINKEDIN_API_VERSION = "202405";

// Minimum scopes to read own profile + posts via the Versioned REST API.
// `w_member_social` allows reading own UGC/shares.
// `r_liteprofile` for profile name.
// `openid profile email` for OIDC-style sign-in if needed.
export const LINKEDIN_SCOPES = "r_liteprofile w_member_social";

export function getLinkedinConfig() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl.replace(/\/+$/, "")}/api/oauth/linkedin/callback`;
  return { clientId, clientSecret, redirectUri, appUrl };
}

export function isLinkedinConfigured(): boolean {
  const { clientId, clientSecret } = getLinkedinConfig();
  return Boolean(clientId && clientSecret);
}

export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri } = getLinkedinConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId!,
    redirect_uri: redirectUri,
    state,
    scope: LINKEDIN_SCOPES,
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

export interface LinkedinTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
}

export async function exchangeCodeForToken(
  code: string,
): Promise<LinkedinTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getLinkedinConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId!,
    client_secret: clientSecret!,
  });
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LinkedIn token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as LinkedinTokenResponse;
}

export interface LinkedinProfile {
  id: string;
  localizedFirstName?: string;
  localizedLastName?: string;
}

export async function fetchProfile(accessToken: string): Promise<LinkedinProfile> {
  const res = await fetch(`${LINKEDIN_API_BASE}/v2/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": LINKEDIN_API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LinkedIn profile fetch failed: ${res.status} ${text}`);
  }
  return (await res.json()) as LinkedinProfile;
}

export interface LinkedinUgcPost {
  id: string;
  commentary?: string;
  createdAt?: number;
  lifecycleState?: string;
}

export async function fetchOwnPosts(
  accessToken: string,
  personId: string,
  count = 20,
): Promise<LinkedinUgcPost[]> {
  // Versioned REST endpoint for reading own posts.
  // URN of the authenticated member as author.
  const authorUrn = encodeURIComponent(`urn:li:person:${personId}`);
  const url = `${LINKEDIN_API_BASE}/rest/posts?q=author&author=${authorUrn}&count=${count}&sortBy=CREATED`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": LINKEDIN_API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LinkedIn posts fetch failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { elements?: Array<Record<string, unknown>> };
  return (data.elements ?? []).map((el) => ({
    id: String(el.id ?? ""),
    commentary: (el.commentary as string | undefined) ?? undefined,
    createdAt: el.createdAt as number | undefined,
    lifecycleState: el.lifecycleState as string | undefined,
  }));
}
