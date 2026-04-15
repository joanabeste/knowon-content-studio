import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildGenerationSchema,
  parseGeneratedContent,
  type GeneratedContent,
} from "./schemas";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { getOpenAI, OPENAI_TEXT_MODEL } from "./client";
import { loadWpCredentials } from "@/lib/wordpress/credentials";
import { fetchWordpressCategoryNames } from "@/lib/wordpress/client";
import { cleanHashtags } from "@/lib/hashtags";
import type {
  BrandVoice,
  Channel,
  ChannelBrandVoice,
  ContextDocument,
  SourcePost,
} from "@/lib/supabase/types";

export interface VariantRow {
  channel: Channel;
  body: string;
  metadata: Record<string, unknown>;
}

export interface GenerateVariantsInput {
  topic: string;
  brief: string | null;
  channels: Channel[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>;
  /** Optional extra instruction appended to the user prompt. */
  extraPrompt?: string | null;
}

/**
 * Generates content variants for the given channels via OpenAI.
 * Loads brand voice (general + per-channel), channel-relevant source
 * posts, and active context documents. Returns the variant rows
 * ready to be inserted (no DB writes happen here).
 */
export async function generateVariantsForChannels(
  input: GenerateVariantsInput,
): Promise<{ error: string } | { rows: VariantRow[] }> {
  const { topic, brief, channels, supabase, extraPrompt } = input;

  if (channels.length === 0) {
    return { error: "Mindestens einen Kanal auswählen." };
  }

  const [
    { data: brandVoice },
    { data: channelVoices },
    { data: inspirations },
    { data: docs },
  ] = await Promise.all([
    supabase.from("brand_voice").select("*").eq("id", 1).single(),
    supabase.from("channel_brand_voice").select("*"),
    supabase
      .from("source_posts")
      .select("*")
      .in("channel", channels)
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(30 * channels.length),
    supabase
      .from("context_documents")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false }),
  ]);

  const channelVoiceMap: Partial<Record<Channel, ChannelBrandVoice>> = {};
  for (const cv of (channelVoices ?? []) as ChannelBrandVoice[]) {
    channelVoiceMap[cv.channel] = cv;
  }

  // Best-effort: fetch existing WP categories so GPT can pick from
  // the current taxonomy instead of inventing new ones. Only loaded
  // when the blog channel is actually requested; errors are swallowed
  // so generation never fails because WordPress is unreachable.
  let existingWpCategories: string[] = [];
  if (channels.includes("blog")) {
    try {
      const creds = await loadWpCredentials();
      if (creds) {
        existingWpCategories = await fetchWordpressCategoryNames(creds);
      }
    } catch {
      existingWpCategories = [];
    }
  }

  const promptInput = {
    topic,
    brief,
    selectedChannels: channels,
    brandVoice: (brandVoice ?? null) as BrandVoice | null,
    channelBrandVoices: channelVoiceMap,
    sourcePosts: (inspirations ?? []) as SourcePost[],
    contextDocuments: (docs ?? []) as ContextDocument[],
    existingWpCategories,
    extraPrompt,
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
        json_schema: buildGenerationSchema(channels),
      },
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    parsed = parseGeneratedContent(JSON.parse(raw), channels);
  } catch (err) {
    console.error("[generateVariantsForChannels] OpenAI error", err);
    return {
      error:
        "Generierung fehlgeschlagen. Prüfe OPENAI_API_KEY & Modell, oder versuche es erneut.",
    };
  }

  const rows: VariantRow[] = channels.map((channel) => {
    let body = "";
    let metadata: Record<string, unknown> = {};
    if (channel === "linkedin" && parsed.linkedin) {
      body = parsed.linkedin.body;
      metadata = { hashtags: cleanHashtags(parsed.linkedin.hashtags) };
    } else if (channel === "instagram" && parsed.instagram) {
      body = parsed.instagram.caption;
      metadata = { hashtags: cleanHashtags(parsed.instagram.hashtags) };
    } else if (channel === "eyefox" && parsed.eyefox) {
      body = parsed.eyefox.body;
    } else if (channel === "newsletter" && parsed.newsletter) {
      body = parsed.newsletter.body;
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
        suggested_categories: parsed.blog.suggested_categories,
      };
    }
    return { channel, body, metadata };
  });

  return { rows };
}
