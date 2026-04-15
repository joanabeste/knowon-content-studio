"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

/**
 * Drag & drop target: move a variant to a new day. We preserve
 * the original time-of-day if a schedule already exists so drag
 * only changes the date, not the planned hour. For variants that
 * were never scheduled (being dragged from "unscheduled" → a day),
 * we default to 09:00 local — reasonable publishing slot.
 */
export async function reschedulePost(
  variantId: string,
  targetDateIso: string,
) {
  const { supabase, user, profile } = await requireUser();

  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Nur Admin/Editor dürfen Posts umplanen." };
  }

  const target = new Date(targetDateIso);
  if (Number.isNaN(target.getTime())) {
    return { error: "Ungültiges Datum." };
  }

  const { data: existing } = await supabase
    .from("content_variants")
    .select("scheduled_at, project_id")
    .eq("id", variantId)
    .single();

  const row = existing as
    | { scheduled_at: string | null; project_id: string }
    | null;

  let nextDate = new Date(target);
  if (row?.scheduled_at) {
    const prev = new Date(row.scheduled_at);
    nextDate.setHours(
      prev.getHours(),
      prev.getMinutes(),
      prev.getSeconds(),
      0,
    );
  } else {
    nextDate.setHours(9, 0, 0, 0);
  }

  const { error } = await supabase
    .from("content_variants")
    .update({
      scheduled_at: nextDate.toISOString(),
      updated_by: user.id,
    })
    .eq("id", variantId);

  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "variant_rescheduled",
    target_type: "content_variant",
    target_id: variantId,
  });

  revalidatePath("/calendar");
  if (row?.project_id) revalidatePath(`/projects/${row.project_id}`);
  return { ok: true, scheduled_at: nextDate.toISOString() };
}
