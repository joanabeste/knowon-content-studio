"use server";

import { redirect } from "next/navigation";
import { getOpenAI, OPENAI_TEXT_MODEL } from "@/lib/openai/client";
import {
  buildGenerationSchema,
  parseGeneratedContent,
  type GeneratedContent,
} from "@/lib/openai/schemas";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/openai/prompts";
import { requireUser } from "@/lib/auth";
import {
  ALL_CHANNELS,
  type BrandVoice,
  type Channel,
  type ChannelBrandVoice,
  type GoldenExample,
} from "@/lib/supabase/types";

function parseSelectedChannels(formData: FormData): Channel[] {
  const raw = formData.getAll("channels").map(String) as Channel[];
  const valid = raw.filter((c) =>
    (ALL_CHANNELS as string[]).includes(c),
  ) as Channel[];
  // Deduplicate
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

  // Load brand voice (general + channel overrides) + golden examples
  const [
    { data: brandVoice },
    { data: channelVoices },
    { data: examples },
  ] = await Promise.all([
    supabase.from("brand_voice").select("*").eq("id", 1).single(),
    supabase.from("channel_brand_voice").select("*"),
    supabase
      .from("golden_examples")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  const channelVoiceMap: Partial<Record<Channel, ChannelBrandVoice>> = {};
  for (const cv of (channelVoices ?? []) as ChannelBrandVoice[]) {
    channelVoiceMap[cv.channel] = cv;
  }

  const promptInput = {
    topic,
    brief,
    selectedChannels,
    brandVoice: (brandVoice ?? null) as BrandVoice | null,
    channelBrandVoices: channelVoiceMap,
    goldenExamples: (examples ?? []) as GoldenExample[],
  };

  const systemPrompt = buildSystemPrompt(promptInput);
  const userPrompt = buildUserPrompt(promptInput);

  let parsed: GeneratedContent;
  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: OPENAI_TEXT_MODEL,
      temperature: 0.8,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: buildGenerationSchema(selectedChannels),
      },
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    parsed = parseGeneratedContent(JSON.parse(raw), selectedChannels);
  } catch (err) {
    console.error("[generateContent] OpenAI error", err);
    return {
      error:
        "Generierung fehlgeschlagen. Prüfe OPENAI_API_KEY & Modell, oder versuche es erneut.",
    };
  }

  // Persist project + variants (only for selected channels)
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

  const variantRows = selectedChannels.map((channel) => {
    let body = "";
    let metadata: Record<string, unknown> = {};
    if (channel === "linkedin" && parsed.linkedin) {
      body = parsed.linkedin.body;
      metadata = { hashtags: parsed.linkedin.hashtags };
    } else if (channel === "instagram" && parsed.instagram) {
      body = parsed.instagram.caption;
      metadata = { hashtags: parsed.instagram.hashtags };
    } else if (channel === "eyefox" && parsed.eyefox) {
      body = parsed.eyefox.body;
    } else if (channel === "newsletter" && parsed.newsletter) {
      body = parsed.newsletter.html_body;
      metadata = {
        subject: parsed.newsletter.subject,
        preheader: parsed.newsletter.preheader,
      };
    } else if (channel === "blog" && parsed.blog) {
      body = parsed.blog.html_body;
      metadata = {
        title: parsed.blog.title,
        slug: parsed.blog.slug,
        excerpt: parsed.blog.excerpt,
        meta_description: parsed.blog.meta_description,
        suggested_tags: parsed.blog.suggested_tags,
      };
    }
    return {
      project_id: project.id,
      channel,
      version: 1,
      body,
      metadata,
      status: "draft" as const,
    };
  });

  const { error: varErr } = await supabase
    .from("content_variants")
    .insert(variantRows);

  if (varErr) {
    console.error(varErr);
    return { error: "Varianten konnten nicht gespeichert werden." };
  }

  // Audit log
  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "generated",
    target_type: "content_project",
    target_id: project.id,
    payload: { topic, channels: selectedChannels },
  });

  redirect(`/projects/${project.id}`);
}
