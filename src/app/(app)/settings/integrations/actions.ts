"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { saveWpCredentials } from "@/lib/wordpress/credentials";
import { verifyCredentials } from "@/lib/wordpress/client";
import { getFormBool, getFormString } from "@/lib/forms";

/**
 * Shared shape + validation for WordPress-credential forms. Both the
 * "save" and "test" actions consume the exact same 3-field payload,
 * so we parse once here to avoid drifting between the two.
 */
function parseWpCredentialsForm(
  formData: FormData,
):
  | { ok: true; creds: { baseUrl: string; username: string; applicationPassword: string } }
  | { ok: false; error: string } {
  const baseUrl = getFormString(formData, "base_url");
  const username = getFormString(formData, "username");
  const applicationPassword = getFormString(formData, "app_password");

  if (!baseUrl || !username || !applicationPassword) {
    return { ok: false, error: "Alle Felder sind erforderlich." };
  }
  if (!/^https?:\/\//.test(baseUrl)) {
    return { ok: false, error: "Base URL muss mit http:// oder https:// beginnen." };
  }

  return { ok: true, creds: { baseUrl, username, applicationPassword } };
}

export async function saveWordpressCredentials(formData: FormData) {
  const { user } = await requireRole("admin");

  const parsed = parseWpCredentialsForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const shouldTest = getFormBool(formData, "test");

  if (shouldTest) {
    const result = await verifyCredentials(parsed.creds);
    if (!result.ok) {
      return { error: `Test fehlgeschlagen: ${result.error}` };
    }
  }

  try {
    await saveWpCredentials(parsed.creds, user.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Speichern fehlgeschlagen: ${msg}` };
  }

  revalidatePath("/settings/integrations");
  return { ok: true };
}

export async function testWordpressCredentials(formData: FormData) {
  await requireRole("admin");
  const parsed = parseWpCredentialsForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const result = await verifyCredentials(parsed.creds);
  if (!result.ok) return { error: result.error ?? "Unbekannter Fehler" };
  return { ok: true, name: result.name };
}
