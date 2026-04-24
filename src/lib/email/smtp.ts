import nodemailer, { type Transporter } from "nodemailer";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { decryptString } from "@/lib/crypto";

export type SmtpRow = {
  host: string | null;
  port: number | null;
  username: string | null;
  password_encrypted: string | null;
  from_name: string | null;
  from_email: string | null;
  secure: boolean;
};

export async function loadSmtpRow(): Promise<SmtpRow | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("smtp_config")
    .select(
      "host, port, username, password_encrypted, from_name, from_email, secure",
    )
    .eq("id", 1)
    .maybeSingle();
  return (data as SmtpRow | null) ?? null;
}

export async function getSmtpTransport(): Promise<{
  transport: Transporter;
  from: string;
}> {
  const row = await loadSmtpRow();
  if (!row) throw new Error("SMTP ist nicht konfiguriert.");
  if (!row.host || !row.port || !row.from_email) {
    throw new Error("SMTP-Konfiguration unvollständig (Host/Port/Absender).");
  }

  const password = row.password_encrypted
    ? decryptString(row.password_encrypted)
    : undefined;

  const transport = nodemailer.createTransport({
    host: row.host,
    port: row.port,
    secure: row.secure,
    auth:
      row.username && password
        ? { user: row.username, pass: password }
        : undefined,
  });

  const from = row.from_name
    ? `"${row.from_name}" <${row.from_email}>`
    : row.from_email;

  return { transport, from };
}
