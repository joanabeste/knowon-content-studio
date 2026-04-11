import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  type Channel,
  type ContentProject,
  type ContentVariant,
  type ImageRow,
  type VariantStatus,
} from "@/lib/supabase/types";
import { ProjectDetailClient } from "./project-detail-client";
import { DeleteProjectButton } from "./delete-project-button";
import type { ImageWithUrl } from "./blog-image-panel";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await requireUser();

  const { data: project } = await supabase
    .from("content_projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const { data: variantsData } = await supabase
    .from("content_variants")
    .select("*")
    .eq("project_id", id)
    .order("version", { ascending: false });

  const variants = (variantsData ?? []) as ContentVariant[];

  // Latest version per channel
  const latestByChannel = new Map<Channel, ContentVariant>();
  for (const v of variants) {
    if (!latestByChannel.has(v.channel)) latestByChannel.set(v.channel, v);
  }

  // Load images for this project
  const { data: imagesData } = await supabase
    .from("images")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  // Generate signed URLs for images (service role bypasses RLS for consistency)
  const admin = getSupabaseAdmin();
  const imagesWithUrls: ImageWithUrl[] = [];
  for (const img of (imagesData ?? []) as ImageRow[]) {
    const { data: signed } = await admin.storage
      .from("generated-images")
      .createSignedUrl(img.storage_path, 3600);
    imagesWithUrls.push({ ...img, signedUrl: signed?.signedUrl ?? null });
  }

  const p = project as ContentProject;
  const canDelete = profile.role === "admin" || p.created_by === profile.id;

  // Respect requested_channels; fall back to all if legacy project has none set
  const channels: Channel[] =
    p.requested_channels && p.requested_channels.length > 0
      ? p.requested_channels
      : ALL_CHANNELS;

  // Aggregation stats
  const statusCounts: Record<VariantStatus, number> = {
    draft: 0,
    in_review: 0,
    approved: 0,
    published: 0,
  };
  for (const ch of channels) {
    const v = latestByChannel.get(ch);
    if (v) statusCounts[v.status] += 1;
  }
  const total = channels.length;
  const approvedOrPublished = statusCounts.approved + statusCounts.published;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted">
            {approvedOrPublished}/{total} freigegeben
          </Badge>
          {statusCounts.in_review > 0 && (
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
            >
              {statusCounts.in_review} in Review
            </Badge>
          )}
          {statusCounts.draft > 0 && (
            <Badge variant="muted">{statusCounts.draft} Entwurf</Badge>
          )}
          {statusCounts.published > 0 && (
            <Badge variant="default">
              {statusCounts.published} veröffentlicht
            </Badge>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            Erstellt {formatDate(p.created_at)}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold leading-tight">{p.topic}</h1>
          {canDelete && (
            <DeleteProjectButton projectId={p.id} topic={p.topic} />
          )}
        </div>
        {p.brief && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {p.brief}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {channels.map((ch) => (
            <Badge key={ch} variant="secondary" className="capitalize">
              {CHANNEL_LABELS[ch]}
            </Badge>
          ))}
        </div>
      </div>

      <ProjectDetailClient
        projectId={id}
        channels={channels}
        variants={Array.from(latestByChannel.values()).filter((v) =>
          channels.includes(v.channel),
        )}
        images={imagesWithUrls}
        role={profile.role}
      />
    </div>
  );
}
