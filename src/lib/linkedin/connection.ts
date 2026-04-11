import { getSupabaseAdmin } from "@/lib/supabase/server";
import { decryptString } from "@/lib/crypto";

export interface LinkedinConnection {
  accessToken: string;
  externalId: string;
  externalName: string | null;
  expiresAt: Date | null;
}

export async function loadLinkedinConnection(): Promise<LinkedinConnection | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("platform_connections")
    .select(
      "access_token_encrypted, expires_at, external_id, external_name",
    )
    .eq("platform", "linkedin")
    .maybeSingle();

  if (!data || !data.access_token_encrypted || !data.external_id) return null;

  try {
    const accessToken = decryptString(data.access_token_encrypted);
    return {
      accessToken,
      externalId: data.external_id,
      externalName: data.external_name,
      expiresAt: data.expires_at ? new Date(data.expires_at) : null,
    };
  } catch (err) {
    console.error("[loadLinkedinConnection] decrypt failed", err);
    return null;
  }
}

export async function disconnectLinkedin() {
  const admin = getSupabaseAdmin();
  await admin.from("platform_connections").delete().eq("platform", "linkedin");
}
