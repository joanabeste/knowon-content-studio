"use server";

import { redirect } from "next/navigation";
import { getOpenAI, OPENAI_TEXT_MODEL } from "@/lib/openai/client";
import {
  generatedContentJsonSchema,
  generatedContentSchema,
  type GeneratedContent,
} from "@/lib/openai/schemas";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/openai/prompts";
import { requireUser } from "@/lib/auth";
import type {
  BrandVoice,
  Channel,
  GoldenExample,
} from "@/lib/supabase/types";

const CHANNELS: Channel[] = [
  "linkedin",
  "instagram",
  "eyefox",
  "newsletter",
  "blog",
];

export async function generateContent(formData: FormData) {
  const { supabase, user, profile } = await requireUser();

  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "Reviewer können keinen Content erzeugen." };
  }

  const topic = String(formData.get("topic") || "").trim();
  const brief = String(formData.get("brief") || "").trim() || null;

  if (!topic) return { error: "Thema fehlt." };

  // Load brand voice + golden examples
  const [{ data: brandVoice }, { data: examples }] = await Promise.all([
    supabase.from("brand_voice").select("*").eq("id", 1).single(),
    supabase.from("golden_examples").select("*").order("created_at", { ascending: false }),
  ]);

  const systemPrompt = buildSystemPrompt({
    topic,
    brief,
    brandVoice: (brandVoice ?? null) as BrandVoice | null,
    goldenExamples: (examples ?? []) as GoldenExample[],
  });

  const userPrompt = buildUserPrompt({
    topic,
    brief,
    brandVoice: (brandVoice ?? null) as BrandVoice | null,
    goldenExamples: (examples ?? []) as GoldenExample[],
  });

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
        json_schema: generatedContentJsonSchema,
      },
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    parsed = generatedContentSchema.parse(JSON.parse(raw));
  } catch (err) {
    console.error("[generateContent] OpenAI error", err);
    return {
      error:
        "Generierung fehlgeschlagen. Prüfe OPENAI_API_KEY & Modell, oder versuche es erneut.",
    };
  }

  // Persist project + 5 variants (version 1)
  const { data: project, error: projErr } = await supabase
    .from("content_projects")
    .insert({
      topic,
      brief,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (projErr || !project) {
    console.error(projErr);
    return { error: "Projekt konnte nicht gespeichert werden." };
  }

  const variantRows = CHANNELS.map((channel) => {
    const v = parsed[channel];
    let body = "";
    let metadata: Record<string, unknown> = {};
    if (channel === "linkedin") {
      body = parsed.linkedin.body;
      metadata = { hashtags: parsed.linkedin.hashtags };
    } else if (channel === "instagram") {
      body = parsed.instagram.caption;
      metadata = { hashtags: parsed.instagram.hashtags };
    } else if (channel === "eyefox") {
      body = parsed.eyefox.body;
    } else if (channel === "newsletter") {
      body = parsed.newsletter.html_body;
      metadata = {
        subject: parsed.newsletter.subject,
        preheader: parsed.newsletter.preheader,
      };
    } else if (channel === "blog") {
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
    payload: { topic },
  });

  redirect(`/projects/${project.id}`);
}
