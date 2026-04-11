import { getSupabaseAdmin } from "@/lib/supabase/server";
import { decryptString, encryptString } from "@/lib/crypto";
import type { WpCredentials } from "./client";

/**
 * Loads WordPress credentials. Preference:
 *  1. Row in `integrations` table with encrypted app password (text)
 *  2. Env vars WORDPRESS_BASE_URL / WORDPRESS_USERNAME / WORDPRESS_APP_PASSWORD
 */
export async function loadWpCredentials(): Promise<WpCredentials | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("integrations")
    .select("wp_base_url, wp_username, wp_app_password_encrypted")
    .eq("id", 1)
    .single();

  if (
    data?.wp_base_url &&
    data.wp_username &&
    data.wp_app_password_encrypted &&
    typeof data.wp_app_password_encrypted === "string"
  ) {
    try {
      const applicationPassword = decryptString(
        data.wp_app_password_encrypted,
      );
      return {
        baseUrl: data.wp_base_url,
        username: data.wp_username,
        applicationPassword,
      };
    } catch (err) {
      console.error("[loadWpCredentials] decrypt failed", err);
      // fall through to env fallback
    }
  }

  // Env var fallback
  const envBase = process.env.WORDPRESS_BASE_URL;
  const envUser = process.env.WORDPRESS_USERNAME;
  const envPass = process.env.WORDPRESS_APP_PASSWORD;
  if (envBase && envUser && envPass) {
    return {
      baseUrl: envBase,
      username: envUser,
      applicationPassword: envPass,
    };
  }
  return null;
}

/**
 * Saves credentials into `integrations` row id=1.
 *
 * The application password is encrypted at the app level (AES-256-GCM)
 * via lib/crypto.ts — the resulting base64 string is stored as text.
 * We deliberately do NOT use Postgres' bytea roundtripping because
 * Supabase-JS doesn't convert it reliably in both directions.
 */
export async function saveWpCredentials(
  creds: WpCredentials,
  userId: string,
) {
  const admin = getSupabaseAdmin();

  // WP generates app passwords with spaces like "abcd efgh ijkl ...".
  // WordPress accepts them either with or without spaces, but we keep
  // them as-is so admin can compare against what they copy-pasted.
  const encryptedBase64 = encryptString(creds.applicationPassword);

  const { error } = await admin
    .from("integrations")
    .update({
      wp_base_url: creds.baseUrl.replace(/\/+$/, ""),
      wp_username: creds.username,
      wp_app_password_encrypted: encryptedBase64,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", 1);

  if (error) throw new Error(error.message);
}
