/**
 * Minimal Instagram Graph API client (via Meta / Facebook OAuth).
 * Requires a Meta Developer App with Instagram Business + Facebook Login
 * products, and a Business Instagram account linked to a Facebook Page.
 */

export const META_AUTH_URL = "https://www.facebook.com/v21.0/dialog/oauth";
export const META_TOKEN_URL =
  "https://graph.facebook.com/v21.0/oauth/access_token";
export const META_GRAPH_BASE = "https://graph.facebook.com/v21.0";

export const META_SCOPES =
  "instagram_basic,pages_show_list,pages_read_engagement,business_management";

export function getMetaConfig() {
  const clientId = process.env.META_CLIENT_ID;
  const clientSecret = process.env.META_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl.replace(/\/+$/, "")}/api/oauth/instagram/callback`;
  return { clientId, clientSecret, redirectUri, appUrl };
}

export function isMetaConfigured(): boolean {
  const { clientId, clientSecret } = getMetaConfig();
  return Boolean(clientId && clientSecret);
}

export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri } = getMetaConfig();
  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri,
    state,
    scope: META_SCOPES,
    response_type: "code",
  });
  return `${META_AUTH_URL}?${params.toString()}`;
}

export interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export async function exchangeCodeForToken(
  code: string,
): Promise<MetaTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getMetaConfig();
  const url = new URL(META_TOKEN_URL);
  url.searchParams.set("client_id", clientId!);
  url.searchParams.set("client_secret", clientSecret!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Meta token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as MetaTokenResponse;
}

/**
 * Resolves the Instagram Business Account ID connected to the user's
 * Facebook Pages. Returns the first IG account found.
 */
export async function findInstagramBusinessId(
  accessToken: string,
): Promise<{ igUserId: string; pageName: string } | null> {
  const pagesUrl = new URL(`${META_GRAPH_BASE}/me/accounts`);
  pagesUrl.searchParams.set("access_token", accessToken);
  pagesUrl.searchParams.set("fields", "id,name,instagram_business_account");
  const res = await fetch(pagesUrl.toString(), { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Meta /me/accounts failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    data?: Array<{
      id: string;
      name: string;
      instagram_business_account?: { id: string };
    }>;
  };
  const firstWithIg = (data.data ?? []).find(
    (p) => p.instagram_business_account?.id,
  );
  if (!firstWithIg?.instagram_business_account) return null;
  return {
    igUserId: firstWithIg.instagram_business_account.id,
    pageName: firstWithIg.name,
  };
}

export interface IgMedia {
  id: string;
  caption?: string;
  media_type?: string;
  permalink?: string;
  timestamp?: string;
}

export async function fetchInstagramMedia(
  accessToken: string,
  igUserId: string,
  limit = 20,
): Promise<IgMedia[]> {
  const url = new URL(`${META_GRAPH_BASE}/${igUserId}/media`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("fields", "id,caption,media_type,permalink,timestamp");
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Instagram media fetch failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { data?: IgMedia[] };
  return data.data ?? [];
}
