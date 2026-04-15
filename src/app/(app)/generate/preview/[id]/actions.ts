"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { generateVariantsForChannels } from "@/lib/openai/generate-variants";
import type { Channel } from "@/lib/supabase/types";

async function loadPreviewProject(
  projectId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
) {
  const { data } = await supabase
    .from("content_projects")
    .select("id, topic, brief, created_by, is_preview")
    .eq("id", projectId)
    .single();
  const p = data as {
    id: string;
    topic: string;
    brief: string | null;
    created_by: string | null;
    is_preview: boolean;
  } | null;
  if (!p) return { error: "Projekt nicht gefunden." };
  if (!p.is_preview) {
    return { error: "Projekt wurde bereits übernommen." };
  }
  if (p.created_by !== userId) {
    return { error: "Nur der Ersteller darf dieses Preview verwalten." };
  }
  return { project: p };
}

/**
 * Final-accept the preview: clear the is_preview flag so the project
 * shows up in the normal list and can be worked on like any other.
 * Redirects to the project detail page so the user continues from
 * there.
 */
export async function acceptPreview(projectId: string) {
  const { supabase, user } = await requireUser();
  const res = await loadPreviewProject(projectId, supabase, user.id);
  if ("error" in res) return { error: res.error };

  const { error } = await supabase
    .from("content_projects")
    .update({ is_preview: false })
    .eq("id", projectId);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "preview_accepted",
    target_type: "content_project",
    target_id: projectId,
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(`/projects/${projectId}`);
}

/**
 * Discard the preview: delete project + variants entirely. The user
 * lands back on /generate with a clean slate.
 */
export async function discardPreview(projectId: string) {
  const { supabase, user } = await requireUser();
  const res = await loadPreviewProject(projectId, supabase, user.id);
  if ("error" in res) return { error: res.error };

  // Variants + notes cascade via FK on content_variants.project_id,
  // variant_notes, variant_versions.
  const { error } = await supabase
    .from("content_projects")
    .delete()
    .eq("id", projectId);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "preview_discarded",
    target_type: "content_project",
    target_id: projectId,
  });

  redirect("/generate");
}

/**
 * Regenerate ALL variants in the preview with an optional extra
 * prompt. Unlike the post-acceptance regenerate flow, we don't
 * snapshot into variant_versions here — the preview was never
 * "committed" so old versions aren't interesting history.
 */
export async function regeneratePreview(
  projectId: string,
  extraPrompt: string | null,
) {
  const { supabase, user } = await requireUser();
  const res = await loadPreviewProject(projectId, supabase, user.id);
  if ("error" in res) return { error: res.error };
  const project = res.project;

  const { data: existing } = await supabase
    .from("content_variants")
    .select("id, channel")
    .eq("project_id", projectId);
  const channels = Array.from(
    new Set(
      (existing ?? []).map((v) => (v as { channel: Channel }).channel),
    ),
  ) as Channel[];
  if (channels.length === 0) {
    return { error: "Keine Kanäle im Projekt." };
  }

  const gen = await generateVariantsForChannels({
    topic: project.topic,
    brief: project.brief,
    channels,
    extraPrompt,
    supabase,
  });
  if ("error" in gen) return { error: gen.error };

  // In-place replace: keep variant IDs stable, bump version.
  const byChannel = new Map<Channel, { id: string }>();
  for (const v of existing ?? []) {
    const r = v as { id: string; channel: Channel };
    byChannel.set(r.channel, { id: r.id });
  }

  for (const row of gen.rows) {
    const prev = byChannel.get(row.channel);
    if (!prev) continue;
    await supabase
      .from("content_variants")
      .update({
        body: row.body,
        metadata: row.metadata,
        updated_by: user.id,
      })
      .eq("id", prev.id);
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "preview_regenerated",
    target_type: "content_project",
    target_id: projectId,
    payload: { extra_prompt: extraPrompt },
  });

  revalidatePath(`/generate/preview/${projectId}`);
  return { ok: true };
}
