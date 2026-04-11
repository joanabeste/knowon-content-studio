"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { ContentVariant, VariantStatus } from "@/lib/supabase/types";

export async function updateVariantBody(
  variantId: string,
  body: string,
  metadata: Record<string, unknown> | null,
) {
  const { supabase, profile } = await requireUser();
  if (profile.role === "reviewer") {
    return { error: "Reviewer dürfen Inhalte nicht bearbeiten." };
  }

  const { data: variant } = await supabase
    .from("content_variants")
    .select("project_id")
    .eq("id", variantId)
    .single();

  const { error } = await supabase
    .from("content_variants")
    .update({ body, metadata })
    .eq("id", variantId);

  if (error) return { error: error.message };
  if (variant) revalidatePath(`/projects/${variant.project_id}`);
  return { ok: true };
}

export async function setVariantStatus(
  variantId: string,
  status: VariantStatus,
) {
  const { supabase, user, profile } = await requireUser();

  // Role gating
  if (status === "approved" && profile.role === "editor") {
    return { error: "Nur Reviewer/Admin können freigeben." };
  }
  if (status === "published" && profile.role === "reviewer") {
    return { error: "Reviewer können nicht veröffentlichen." };
  }

  const { data: variant } = await supabase
    .from("content_variants")
    .select("project_id")
    .eq("id", variantId)
    .single();

  const update: Partial<ContentVariant> = { status };
  if (status === "approved") {
    update.reviewed_by = user.id;
    update.reviewed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("content_variants")
    .update(update)
    .eq("id", variantId);

  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: `variant_status_${status}`,
    target_type: "content_variant",
    target_id: variantId,
  });

  if (variant) revalidatePath(`/projects/${variant.project_id}`);
  return { ok: true };
}

export async function regenerateVariant(variantId: string) {
  // Stub — to be implemented in Phase 2.
  // Idea: load project + brand voice + examples, call OpenAI for ONE channel,
  // insert a new row with version = max+1, status = 'draft'.
  return { error: "Regenerieren pro Kanal kommt in Phase 2." };
}
