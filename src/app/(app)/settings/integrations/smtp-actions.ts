"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { EMPTY_SMTP, type SmtpConfig } from "./smtp-types";

export async function loadSmtpConfig(): Promise<SmtpConfig> {
  const { supabase } = await requireRole("admin");
  const { data } = await supabase
    .from("smtp_config")
    .select("host, port, username, password, from_name, from_email, secure")
    .eq("id", 1)
    .single();
  return (data as SmtpConfig | null) ?? EMPTY_SMTP;
}

export async function saveSmtpConfig(config: SmtpConfig) {
  const { supabase, user } = await requireRole("admin");

  const clean: SmtpConfig & { id: number; updated_by: string; updated_at: string } = {
    id: 1,
    host: config.host?.trim() || null,
    port: config.port ?? null,
    username: config.username?.trim() || null,
    password: config.password || null,
    from_name: config.from_name?.trim() || null,
    from_email: config.from_email?.trim() || null,
    secure: config.secure,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("smtp_config")
    .upsert(clean, { onConflict: "id" });
  if (error) return { error: error.message };

  revalidatePath("/settings/integrations");
  return { ok: true };
}
