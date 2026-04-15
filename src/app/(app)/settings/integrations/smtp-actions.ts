"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { encryptString } from "@/lib/crypto";
import { EMPTY_SMTP, type SmtpConfig, type SmtpConfigInput } from "./smtp-types";

/**
 * Load the SMTP config for the form. Returns a `password_set` boolean
 * instead of the plaintext password — the UI never needs to read back
 * the stored password, only display whether one is configured.
 */
export async function loadSmtpConfig(): Promise<SmtpConfig> {
  const { supabase } = await requireRole("admin");
  const { data } = await supabase
    .from("smtp_config")
    .select(
      "host, port, username, password_encrypted, from_name, from_email, secure",
    )
    .eq("id", 1)
    .single();
  if (!data) return EMPTY_SMTP;

  const row = data as {
    host: string | null;
    port: number | null;
    username: string | null;
    password_encrypted: string | null;
    from_name: string | null;
    from_email: string | null;
    secure: boolean;
  };

  return {
    host: row.host,
    port: row.port,
    username: row.username,
    password_set:
      !!row.password_encrypted && row.password_encrypted.length > 0,
    from_name: row.from_name,
    from_email: row.from_email,
    secure: row.secure,
  };
}

export async function saveSmtpConfig(config: SmtpConfigInput) {
  const { supabase, user } = await requireRole("admin");

  // Empty password in the form means "keep the existing one" — we
  // only write password_encrypted when the admin typed something new.
  const nextPasswordEncrypted =
    config.password && config.password.trim() !== ""
      ? encryptString(config.password)
      : undefined;

  const update: Record<string, unknown> = {
    id: 1,
    host: config.host?.trim() || null,
    port: config.port ?? null,
    username: config.username?.trim() || null,
    from_name: config.from_name?.trim() || null,
    from_email: config.from_email?.trim() || null,
    secure: config.secure,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };
  if (nextPasswordEncrypted !== undefined) {
    update.password_encrypted = nextPasswordEncrypted;
  }

  const { error } = await supabase
    .from("smtp_config")
    .upsert(update, { onConflict: "id" });
  if (error) return { error: error.message };

  revalidatePath("/settings/integrations");
  return { ok: true };
}
