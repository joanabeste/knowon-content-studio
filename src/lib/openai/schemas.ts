import { z } from "zod";
import type { Channel } from "@/lib/supabase/types";

// =====================================================================
// Per-channel Zod schemas — used for runtime parsing of OpenAI output.
// =====================================================================

const linkedinSchema = z.object({
  body: z.string(),
  hashtags: z.array(z.string()),
});

const instagramSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
});

const eyefoxSchema = z.object({
  body: z.string(),
});

const newsletterSchema = z.object({
  subject: z.string(),
  preheader: z.string(),
  body: z.string(),
});

const blogSchema = z.object({
  title: z.string(),
  slug: z.string(),
  excerpt: z.string(),
  html_body: z.string(),
  meta_description: z.string(),
  suggested_tags: z.array(z.string()),
  suggested_categories: z.array(z.string()),
});

export const channelZodSchemas = {
  linkedin: linkedinSchema,
  instagram: instagramSchema,
  eyefox: eyefoxSchema,
  newsletter: newsletterSchema,
  blog: blogSchema,
} as const;

export type LinkedInContent = z.infer<typeof linkedinSchema>;
export type InstagramContent = z.infer<typeof instagramSchema>;
export type EyefoxContent = z.infer<typeof eyefoxSchema>;
export type NewsletterContent = z.infer<typeof newsletterSchema>;
export type BlogContent = z.infer<typeof blogSchema>;

export type GeneratedContent = {
  linkedin?: LinkedInContent;
  instagram?: InstagramContent;
  eyefox?: EyefoxContent;
  newsletter?: NewsletterContent;
  blog?: BlogContent;
};

/**
 * Parses OpenAI's JSON response into a typed object, validating each
 * selected channel independently. Channels not in `selectedChannels`
 * are ignored even if present in the payload.
 */
export function parseGeneratedContent(
  raw: unknown,
  selectedChannels: Channel[],
): GeneratedContent {
  if (!raw || typeof raw !== "object") {
    throw new Error("Antwort ist kein Objekt");
  }
  const payload = raw as Record<string, unknown>;
  const result: GeneratedContent = {};
  for (const ch of selectedChannels) {
    const part = payload[ch];
    if (part === undefined) {
      throw new Error(`Kanal '${ch}' fehlt in der Antwort`);
    }
    result[ch] = channelZodSchemas[ch].parse(part) as never;
  }
  return result;
}

// =====================================================================
// JSON Schema builder (for OpenAI `response_format: json_schema`).
// Only includes the channels that were actually requested, so the
// model cannot "waste tokens" on channels we don't want.
// =====================================================================

const channelJsonSchemas: Record<Channel, Record<string, unknown>> = {
  linkedin: {
    type: "object",
    additionalProperties: false,
    required: ["body", "hashtags"],
    properties: {
      body: { type: "string" },
      hashtags: { type: "array", items: { type: "string" } },
    },
  },
  instagram: {
    type: "object",
    additionalProperties: false,
    required: ["caption", "hashtags"],
    properties: {
      caption: { type: "string" },
      hashtags: { type: "array", items: { type: "string" } },
    },
  },
  eyefox: {
    type: "object",
    additionalProperties: false,
    required: ["body"],
    properties: {
      body: { type: "string" },
    },
  },
  newsletter: {
    type: "object",
    additionalProperties: false,
    required: ["subject", "preheader", "body"],
    properties: {
      subject: { type: "string" },
      preheader: { type: "string" },
      body: { type: "string" },
    },
  },
  blog: {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "slug",
      "excerpt",
      "html_body",
      "meta_description",
      "suggested_tags",
      "suggested_categories",
    ],
    properties: {
      title: { type: "string" },
      slug: { type: "string" },
      excerpt: { type: "string" },
      html_body: { type: "string" },
      meta_description: { type: "string" },
      suggested_tags: { type: "array", items: { type: "string" } },
      suggested_categories: { type: "array", items: { type: "string" } },
    },
  },
};

export function buildGenerationSchema(channels: Channel[]) {
  const properties: Record<string, Record<string, unknown>> = {};
  for (const ch of channels) {
    properties[ch] = channelJsonSchemas[ch];
  }
  return {
    name: "marketing_content",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: channels,
      properties,
    },
  };
}
