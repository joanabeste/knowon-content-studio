"use server";

import { redirect } from "next/navigation";
import { generateVariantsForChannels } from "@/lib/openai/generate-variants";
import { requireUser } from "@/lib/auth";
import { ALL_CHANNELS, type Channel } from "@/lib/supabase/types";

function parseSelectedChannels(formData: FormData): Channel[] {
  const raw = formData.getAll("channels").map(String) as Channel[];
  const valid = raw.filter((c) =>
    (ALL_CHANNELS as string[]).includes(c),
  ) as Channel[];
  return Array.from(new Set(valid));
}

export async function generateContent(formData: FormData) {
  const { supabase, user, profile } = await requireUser();

  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Reviewer können keinen Content erzeugen." };
  }

  const topic = String(formData.get("topic") || "").trim();
  const brief = String(formData.get("brief") || "").trim() || null;
  const selectedChannels = parseSelectedChannels(formData);

  if (!topic) return { error: "Thema fehlt." };
  if (selectedChannels.length === 0)
    return { error: "Mindestens einen Kanal auswählen." };

  const result = await generateVariantsForChannels({
    topic,
    brief,
    channels: selectedChannels,
    supabase,
  });
  if ("error" in result) return { error: result.error };

  // Persist project + variants
  const { data: project, error: projErr } = await supabase
    .from("content_projects")
    .insert({
      topic,
      brief,
      status: "draft",
      requested_channels: selectedChannels,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (projErr || !project) {
    console.error(projErr);
    return { error: "Projekt konnte nicht gespeichert werden." };
  }

  const variantRows = result.rows.map((r) => ({
    project_id: project.id,
    channel: r.channel,
    version: 1,
    body: r.body,
    metadata: r.metadata,
    status: "draft" as const,
  }));

  const { error: varErr } = await supabase
    .from("content_variants")
    .insert(variantRows);

  if (varErr) {
    console.error(varErr);
    return { error: "Varianten konnten nicht gespeichert werden." };
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "generated",
    target_type: "content_project",
    target_id: project.id,
    payload: { topic, channels: selectedChannels },
  });

  redirect(`/projects/${project.id}`);
}
