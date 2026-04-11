"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import type { Channel } from "@/lib/supabase/types";

const CHANNELS: Channel[] = [
  "linkedin",
  "instagram",
  "eyefox",
  "newsletter",
  "blog",
];

export async function addExample(formData: FormData) {
  const { supabase, user } = await requireRole("admin");

  const channel = String(formData.get("channel") || "") as Channel;
  const title = String(formData.get("title") || "") || null;
  const body = String(formData.get("body") || "");
  const note = String(formData.get("note") || "") || null;

  if (!CHANNELS.includes(channel)) return { error: "Kanal ungültig." };
  if (!body.trim()) return { error: "Inhalt fehlt." };

  const { error } = await supabase.from("golden_examples").insert({
    channel,
    title,
    body,
    note,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/library/examples");
  return { ok: true };
}

export async function deleteExample(id: string) {
  const { supabase } = await requireRole("admin");
  const { error } = await supabase.from("golden_examples").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/library/examples");
  return { ok: true };
}
