import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  CHANNEL_LABELS,
  type Channel,
  type ContentVariant,
  type ContentProject,
} from "@/lib/supabase/types";
import { PreviewClient } from "./preview-client";

export const dynamic = "force-dynamic";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const { data: projectRaw } = await supabase
    .from("content_projects")
    .select("*")
    .eq("id", id)
    .single();
  const project = projectRaw as ContentProject | null;
  if (!project) redirect("/generate");

  // Ownership + state checks. If the preview was already accepted we
  // bounce to the normal project page; if someone else owns it we
  // hide it.
  if (!project.is_preview) redirect(`/projects/${project.id}`);
  if (project.created_by !== user.id) redirect("/projects");

  const { data: variantsRaw } = await supabase
    .from("content_variants")
    .select("*")
    .eq("project_id", project.id)
    .order("channel", { ascending: true });
  const variants = (variantsRaw ?? []) as ContentVariant[];

  const channelList = variants
    .map((v) => v.channel)
    .map((c) => CHANNEL_LABELS[c as Channel])
    .join(", ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-knowon-pink">
            Vorschau · noch nicht übernommen
          </p>
          <h1 className="mt-1 text-3xl font-bold">{project.topic}</h1>
          {project.brief && (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {project.brief}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Kanäle: {channelList}
          </p>
        </div>
        <Link
          href="/generate"
          className="text-sm text-muted-foreground underline hover:text-foreground"
        >
          Zurück zum Formular
        </Link>
      </div>

      <PreviewClient project={project} variants={variants} />
    </div>
  );
}
