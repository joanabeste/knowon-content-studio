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
  type ContentVariantWithPeople,
  type ImageRow,
  type VariantNote,
  type VariantStatus,
} from "@/lib/supabase/types";
import { ProjectDetailClient } from "./project-detail-client";
import { DeleteProjectButton } from "./delete-project-button";
import type { ImageWithUrl } from "./blog-image-panel";
import {
  ProjectActionsBar,
  type ProfileOption,
} from "./project-actions-bar";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user, profile } = await requireUser();

  const { data: project } = await supabase
    .from("content_projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) notFound();

  // Join author + reviewer profile names so the card can show
  // attribution without extra round-trips
  const { data: variantsData } = await supabase
    .from("content_variants")
    .select(
      `*,
       author:created_by(full_name),
       reviewer:reviewed_by(full_name)`,
    )
    .eq("project_id", id)
    .order("version", { ascending: false });

  const variants = (variantsData ?? []) as ContentVariantWithPeople[];

  // Latest version per channel
  const latestByChannel = new Map<Channel, ContentVariantWithPeople>();
  for (const v of variants) {
    if (!latestByChannel.has(v.channel)) latestByChannel.set(v.channel, v);
  }

  // Fetch all notes for the visible variants in one query. Grouped
  // client-side because variant_notes is a small table and this keeps
  // the page query count flat.
  const visibleVariantIds = Array.from(latestByChannel.values()).map(
    (v) => v.id,
  );
  let notesByVariant = new Map<string, VariantNote[]>();
  if (visibleVariantIds.length > 0) {
    const { data: notesData } = await supabase
      .from("variant_notes")
      .select(`*, author:created_by(full_name)`)
      .in("variant_id", visibleVariantIds)
      .order("created_at", { ascending: true });
    notesByVariant = new Map();
    for (const n of (notesData ?? []) as VariantNote[]) {
      const list = notesByVariant.get(n.variant_id) ?? [];
      list.push(n);
      notesByVariant.set(n.variant_id, list);
    }
  }

  // Load images for this project
  const { data: imagesData } = await supabase
    .from("images")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  // Generate signed URLs for images in parallel. `Promise.all`
  // over the image list means one round-trip per image, not
  // one-per-image-sequentially — on a project with 10 images
  // this goes from ~10× sequential latency to a single wave.
  const admin = getSupabaseAdmin();
  const imagesWithUrls: ImageWithUrl[] = await Promise.all(
    ((imagesData ?? []) as ImageRow[]).map(async (img) => {
      // External-URL images don't live in storage; pass the URL
      // straight through. storage-backed rows keep the signed-URL
      // flow so they remain protected.
      if (img.external_url) {
        return { ...img, signedUrl: img.external_url };
      }
      if (!img.storage_path) {
        return { ...img, signedUrl: null };
      }
      const { data: signed } = await admin.storage
        .from("generated-images")
        .createSignedUrl(img.storage_path, 3600);
      return { ...img, signedUrl: signed?.signedUrl ?? null };
    }),
  );

  // Partition images: project-level (blog hero pool) vs per-variant.
  // Blog-image-panel still wants the project-level list; variants
  // render their own list from the keyed map.
  const projectImages = imagesWithUrls.filter((i) => i.variant_id === null);
  const imagesByVariant: Record<string, ImageWithUrl[]> = {};
  for (const img of imagesWithUrls) {
    if (img.variant_id) {
      const list = imagesByVariant[img.variant_id] ?? [];
      list.push(img);
      imagesByVariant[img.variant_id] = list;
    }
  }

  const p = project as ContentProject;
  const canDelete = profile.role === "admin" || p.created_by === profile.id;

  // Load profile list for assignee dropdowns. Small table — safe to
  // load in full. If the currently-assigned profile isn't in the
  // list (deleted/disabled), pull it separately so the pill still
  // renders a name.
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .order("full_name", { ascending: true });
  const profiles = (profilesData ?? []) as ProfileOption[];
  const assignedProfile =
    p.assigned_to ? (profiles.find((pr) => pr.id === p.assigned_to) ?? null) : null;

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
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>Erstellt {formatDate(p.created_at)}</span>
            {canDelete && (
              <DeleteProjectButton projectId={p.id} topic={p.topic} iconOnly />
            )}
          </div>
        </div>
        {/* pr-14 leaves room for the fixed top-right help button */}
        <div className="pr-14">
          <h1 className="text-3xl font-bold leading-tight">{p.topic}</h1>
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

      <ProjectActionsBar
        project={p}
        variants={Array.from(latestByChannel.values()).filter((v) =>
          channels.includes(v.channel),
        )}
        profiles={profiles}
        assignedProfile={assignedProfile}
        currentUserId={user.id}
        role={profile.role}
      />

      <ProjectDetailClient
        projectId={id}
        channels={channels}
        variants={Array.from(latestByChannel.values()).filter((v) =>
          channels.includes(v.channel),
        )}
        notesByVariant={Object.fromEntries(notesByVariant)}
        images={projectImages}
        imagesByVariant={imagesByVariant}
        role={profile.role}
        currentUserId={user.id}
      />
    </div>
  );
}
