import { z } from "zod";

// Schema for the structured output OpenAI should return.
// Kept simple (only strings/arrays) so it works with json_schema mode.
export const generatedContentSchema = z.object({
  linkedin: z.object({
    body: z.string().describe("LinkedIn-Post-Text, max. 3000 Zeichen, mit Zeilenumbrüchen."),
    hashtags: z.array(z.string()).describe("3-6 Hashtags ohne #-Zeichen."),
  }),
  instagram: z.object({
    caption: z.string().describe("Instagram-Caption, max. 2200 Zeichen."),
    hashtags: z.array(z.string()).describe("10-20 Hashtags ohne #-Zeichen."),
  }),
  eyefox: z.object({
    body: z.string().describe("Eyefox-Partnerseiten-Text: informativ, branchenfokussiert, 200-500 Wörter."),
  }),
  newsletter: z.object({
    subject: z.string().describe("Betreffzeile, max. 60 Zeichen."),
    preheader: z.string().describe("Vorschautext, 80-120 Zeichen."),
    html_body: z.string().describe("Newsletter-Inhalt als einfaches HTML (p, h2, ul, a, strong)."),
  }),
  blog: z.object({
    title: z.string().describe("Blog-Titel, SEO-freundlich."),
    slug: z.string().describe("URL-Slug, kleingeschrieben, Bindestriche."),
    excerpt: z.string().describe("Kurzer Anreißer, 150-200 Zeichen."),
    html_body: z.string().describe("Vollständiger Blog-Inhalt als HTML (h2, h3, p, ul, strong, a)."),
    meta_description: z.string().describe("SEO-Meta-Description, 140-160 Zeichen."),
    suggested_tags: z.array(z.string()).describe("3-6 vorgeschlagene Tags."),
  }),
});

export type GeneratedContent = z.infer<typeof generatedContentSchema>;

// JSON Schema for OpenAI's response_format (strict mode).
export const generatedContentJsonSchema = {
  name: "marketing_content",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["linkedin", "instagram", "eyefox", "newsletter", "blog"],
    properties: {
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
        required: ["subject", "preheader", "html_body"],
        properties: {
          subject: { type: "string" },
          preheader: { type: "string" },
          html_body: { type: "string" },
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
        ],
        properties: {
          title: { type: "string" },
          slug: { type: "string" },
          excerpt: { type: "string" },
          html_body: { type: "string" },
          meta_description: { type: "string" },
          suggested_tags: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;
