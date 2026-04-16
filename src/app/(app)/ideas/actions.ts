"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getFormString, getFormStrings } from "@/lib/forms";
import { ALL_CHANNELS, type Channel } from "@/lib/supabase/types";

function parseChannels(fd: FormData): Channel[] {
  const raw = getFormStrings(fd, "suggested_channels");
  return Array.from(
    new Set(
      raw.filter((c) => (ALL_CHANNELS as string[]).includes(c)) as Channel[],
    ),
  );
}

export async function createIdea(formData: FormData) {
  const { supabase, user, profile } = await requireUser();
  if (profile.role === "reviewer") {
    return { error: "Reviewer können keine Ideen anlegen." };
  }

  const title = getFormString(formData, "title");
  if (!title) return { error: "Titel fehlt." };

  const notes = getFormString(formData, "notes");
  const channels = parseChannels(formData);
  const targetDateRaw = getFormString(formData, "target_date");
  const target_date = targetDateRaw
    ? (() => {
        const d = new Date(targetDateRaw);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
      })()
    : null;

  const { error } = await supabase.from("project_ideas").insert({
    title,
    notes,
    suggested_channels: channels.length > 0 ? channels : null,
    target_date,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/ideas");
  return { ok: true };
}

export async function updateIdea(id: string, formData: FormData) {
  const { supabase, profile } = await requireUser();
  if (profile.role === "reviewer") {
    return { error: "Reviewer können Ideen nicht ändern." };
  }

  const title = getFormString(formData, "title");
  if (!title) return { error: "Titel fehlt." };

  const notes = getFormString(formData, "notes");
  const channels = parseChannels(formData);
  const targetDateRaw = getFormString(formData, "target_date");
  const target_date = targetDateRaw
    ? (() => {
        const d = new Date(targetDateRaw);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
      })()
    : null;

  const { error } = await supabase
    .from("project_ideas")
    .update({
      title,
      notes,
      suggested_channels: channels.length > 0 ? channels : null,
      target_date,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/ideas");
  return { ok: true };
}

export async function deleteIdea(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("project_ideas")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/ideas");
  return { ok: true };
}

export async function archiveIdea(id: string, archive: boolean) {
  const { supabase, profile } = await requireUser();
  if (profile.role === "reviewer") {
    return { error: "Reviewer können Ideen nicht archivieren." };
  }
  const { error } = await supabase
    .from("project_ideas")
    .update({
      archived_at: archive ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/ideas");
  return { ok: true };
}

/**
 * "In Projekt umwandeln": Sprung zur Generate-Seite mit Idee als
 * Query-String vorbelegt. Die Generate-Action liest die `from_idea`
 * ID aus dem Form und setzt nach erfolgreicher Projekt-Anlage das
 * converted_to_project_id zurück auf die Idee.
 */
export async function convertIdeaToProject(id: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("project_ideas")
    .select("id, title, notes, suggested_channels")
    .eq("id", id)
    .single();
  if (!data) return { error: "Idee nicht gefunden." };

  const idea = data as {
    id: string;
    title: string;
    notes: string | null;
    suggested_channels: Channel[] | null;
  };

  const params = new URLSearchParams();
  params.set("from_idea", idea.id);
  params.set("topic", idea.title);
  if (idea.notes) params.set("brief", idea.notes);
  if (idea.suggested_channels && idea.suggested_channels.length > 0) {
    params.set("channels", idea.suggested_channels.join(","));
  }

  redirect(`/generate?${params.toString()}`);
}
