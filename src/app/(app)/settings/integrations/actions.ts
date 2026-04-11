"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { saveWpCredentials } from "@/lib/wordpress/credentials";
import { verifyCredentials } from "@/lib/wordpress/client";

export async function saveWordpressCredentials(formData: FormData) {
  const { user } = await requireRole("admin");

  const baseUrl = String(formData.get("base_url") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const applicationPassword = String(formData.get("app_password") || "").trim();
  const shouldTest = formData.get("test") === "on";

  if (!baseUrl || !username || !applicationPassword) {
    return { error: "Alle Felder sind erforderlich." };
  }
  if (!/^https?:\/\//.test(baseUrl)) {
    return { error: "Base URL muss mit http:// oder https:// beginnen." };
  }

  const creds = { baseUrl, username, applicationPassword };

  if (shouldTest) {
    const result = await verifyCredentials(creds);
    if (!result.ok) {
      return { error: `Test fehlgeschlagen: ${result.error}` };
    }
  }

  try {
    await saveWpCredentials(creds, user.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Speichern fehlgeschlagen: ${msg}` };
  }

  revalidatePath("/settings/integrations");
  return { ok: true };
}

export async function testWordpressCredentials(formData: FormData) {
  await requireRole("admin");
  const baseUrl = String(formData.get("base_url") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const applicationPassword = String(formData.get("app_password") || "").trim();
  if (!baseUrl || !username || !applicationPassword) {
    return { error: "Alle Felder sind erforderlich." };
  }
  const result = await verifyCredentials({
    baseUrl,
    username,
    applicationPassword,
  });
  if (!result.ok) return { error: result.error ?? "Unbekannter Fehler" };
  return { ok: true, name: result.name };
}
