import { getSupabaseAdmin } from "@/lib/supabase/server";
import { decryptString, encryptString } from "@/lib/crypto";
import type { WpCredentials } from "./client";

/**
 * Loads WordPress credentials. Preference:
 *  1. Row in `integrations` table with encrypted app password
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
    data.wp_app_password_encrypted
  ) {
    try {
      // Column is bytea — Supabase returns it as a base64 string with `\x` hex prefix
      // but our encryptString stores base64 text directly. We handle either case.
      const raw = data.wp_app_password_encrypted as unknown as string;
      const cleaned =
        typeof raw === "string" && raw.startsWith("\\x")
          ? Buffer.from(raw.slice(2), "hex").toString("utf8")
          : String(raw);
      const applicationPassword = decryptString(cleaned);
      return {
        baseUrl: data.wp_base_url,
        username: data.wp_username,
        applicationPassword,
      };
    } catch (err) {
      console.error("[loadWpCredentials] decrypt failed", err);
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

/** Saves credentials (encrypting the app password) into `integrations` row id=1. */
export async function saveWpCredentials(
  creds: WpCredentials,
  userId: string,
) {
  const admin = getSupabaseAdmin();
  const encryptedB64 = encryptString(creds.applicationPassword);
  // Store base64 text as bytea literal — Postgres accepts `\x<hex>` form,
  // but we use the text column interface via postgres-js driver: pass as a string.
  // Simpler: convert base64 → hex and use Postgres bytea hex notation.
  const hex = Buffer.from(encryptedB64, "utf8").toString("hex");
  const { error } = await admin
    .from("integrations")
    .update({
      wp_base_url: creds.baseUrl.replace(/\/+$/, ""),
      wp_username: creds.username,
      wp_app_password_encrypted: `\\x${hex}`,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}
