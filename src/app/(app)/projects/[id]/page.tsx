import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type {
  Channel,
  ContentProject,
  ContentVariant,
} from "@/lib/supabase/types";
import { VariantCard } from "./variant-card";

const CHANNEL_LABEL: Record<Channel, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  eyefox: "Eyefox",
  newsletter: "Newsletter",
  blog: "Blog",
};

const CHANNEL_ORDER: Channel[] = [
  "linkedin",
  "instagram",
  "eyefox",
  "newsletter",
  "blog",
];

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

  const { data: variants } = await supabase
    .from("content_variants")
    .select("*")
    .eq("project_id", id)
    .order("version", { ascending: false });

  // Latest version per channel
  const latestByChannel = new Map<Channel, ContentVariant>();
  for (const v of (variants ?? []) as ContentVariant[]) {
    if (!latestByChannel.has(v.channel)) latestByChannel.set(v.channel, v);
  }

  const p = project as ContentProject;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="muted">{p.status}</Badge>
          <span className="text-xs text-muted-foreground">
            Erstellt {formatDate(p.created_at)}
          </span>
        </div>
        <h1 className="text-3xl font-bold">{p.topic}</h1>
        {p.brief && (
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
            {p.brief}
          </p>
        )}
      </div>

      <div className="grid gap-4">
        {CHANNEL_ORDER.map((channel) => {
          const variant = latestByChannel.get(channel);
          if (!variant) {
            return (
              <Card key={channel}>
                <CardHeader>
                  <CardTitle>{CHANNEL_LABEL[channel]}</CardTitle>
                  <CardDescription>Keine Variante vorhanden.</CardDescription>
                </CardHeader>
              </Card>
            );
          }
          return (
            <VariantCard
              key={variant.id}
              variant={variant}
              channelLabel={CHANNEL_LABEL[channel]}
              role={profile.role}
            />
          );
        })}
      </div>
    </div>
  );
}
