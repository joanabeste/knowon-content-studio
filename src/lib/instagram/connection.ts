import { getSupabaseAdmin } from "@/lib/supabase/server";
import { decryptString } from "@/lib/crypto";

export interface InstagramConnection {
  accessToken: string;
  igUserId: string;
  externalName: string | null;
  expiresAt: Date | null;
}

export async function loadInstagramConnection(): Promise<InstagramConnection | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("platform_connections")
    .select(
      "access_token_encrypted, expires_at, external_id, external_name",
    )
    .eq("platform", "instagram")
    .maybeSingle();

  if (!data || !data.access_token_encrypted || !data.external_id) return null;

  try {
    return {
      accessToken: decryptString(data.access_token_encrypted),
      igUserId: data.external_id,
      externalName: data.external_name,
      expiresAt: data.expires_at ? new Date(data.expires_at) : null,
    };
  } catch (err) {
    console.error("[loadInstagramConnection] decrypt failed", err);
    return null;
  }
}

export async function disconnectInstagram() {
  const admin = getSupabaseAdmin();
  await admin
    .from("platform_connections")
    .delete()
    .eq("platform", "instagram");
}
