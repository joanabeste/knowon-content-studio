import type {
  BrandVoice,
  Channel,
  ChannelBrandVoice,
  ContextDocument,
  SourcePost,
} from "@/lib/supabase/types";
import { CHANNEL_LABELS } from "@/lib/supabase/types";

export interface BuildPromptInput {
  topic: string;
  brief: string | null;
  selectedChannels: Channel[];
  brandVoice: BrandVoice | null;
  channelBrandVoices: Partial<Record<Channel, ChannelBrandVoice>>;
  /**
   * Raw pool of inspiration posts. Will be filtered by selectedChannels
   * and sampled intelligently per channel by `pickFewShotSamples`.
   */
  sourcePosts: SourcePost[];
  contextDocuments?: ContextDocument[];
}

// Per-document truncation so one giant document doesn't eat the whole
// context window. The total budget is policed in the caller.
const DOC_EXCERPT_LEN = 6000;

// Few-shot sampling constants
const SAMPLES_PER_CHANNEL = 4;
const POST_EXCERPT_LEN = 800;

/**
 * Picks the top-N most relevant inspiration posts per channel:
 *  1. Featured posts come first
 *  2. Then recency (published_at desc, nulls last)
 *  3. Deterministic tie-break on id
 *
 * Returns a flat list grouped by channel (order preserved).
 */
export function pickFewShotSamples(
  posts: SourcePost[],
  channels: Channel[],
  perChannel = SAMPLES_PER_CHANNEL,
): SourcePost[] {
  const byChannel = new Map<Channel, SourcePost[]>();
  for (const p of posts) {
    const list = byChannel.get(p.channel) ?? [];
    list.push(p);
    byChannel.set(p.channel, list);
  }

  const picked: SourcePost[] = [];
  for (const ch of channels) {
    const list = byChannel.get(ch) ?? [];
    list.sort((a, b) => {
      if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
      const ta = a.published_at ? Date.parse(a.published_at) : 0;
      const tb = b.published_at ? Date.parse(b.published_at) : 0;
      if (ta !== tb) return tb - ta;
      return a.id.localeCompare(b.id);
    });
    picked.push(...list.slice(0, perChannel));
  }
  return picked;
}

export function buildSystemPrompt(input: BuildPromptInput): string {
  const { brandVoice, channelBrandVoices, selectedChannels } = input;

  const parts: string[] = [];

  parts.push(
    "Du bist der Marketing-Content-Generator für KnowOn (https://www.knowon.de), eine Online-Lernplattform für digitale Weiterbildung in der Augenheilkunde.",
    "Deine Aufgabe: aus einem Thema + Briefing passgenaue Content-Varianten für die angeforderten Kanäle in einem Rutsch erzeugen — alle im konsistenten KnowOn-Ton.",
    "Antworte IMMER im vorgegebenen JSON-Schema. Keine Erklärungen außerhalb des JSON.",
    "Sprache: Deutsch.",
  );

  if (brandVoice?.about_knowon) {
    parts.push("## Über KnowOn", brandVoice.about_knowon);
  }

  if (brandVoice?.tone) {
    parts.push("## Tonfall (allgemein)", brandVoice.tone);
  }

  if (brandVoice?.audience) {
    parts.push("## Zielgruppe", brandVoice.audience);
  }

  if (brandVoice?.dos?.length) {
    parts.push(
      "## Do's (allgemein)",
      brandVoice.dos.map((d) => `- ${d}`).join("\n"),
    );
  }

  if (brandVoice?.donts?.length) {
    parts.push(
      "## Don'ts (allgemein)",
      brandVoice.donts.map((d) => `- ${d}`).join("\n"),
    );
  }

  // Context Documents — zusätzliches Wissen aus der Library
  const activeDocs = (input.contextDocuments ?? []).filter((d) => d.is_active);
  if (activeDocs.length) {
    parts.push(
      "## Zusätzliches Kontextwissen",
      "Folgende Dokumente enthalten wichtige Fakten, die du nutzen kannst (aber nicht wörtlich kopieren):",
    );
    for (const doc of activeDocs) {
      const excerpt = doc.content.slice(0, DOC_EXCERPT_LEN);
      parts.push(
        `### ${doc.title}`,
        excerpt + (doc.content.length > DOC_EXCERPT_LEN ? "\n[…gekürzt]" : ""),
      );
    }
  }

  // Few-shot inspiration: top posts per selected channel
  const samples = pickFewShotSamples(input.sourcePosts, selectedChannels);
  if (samples.length) {
    parts.push(
      "## Inspirations-Beispiele",
      "Das sind echte alte KnowOn-Posts pro Kanal. Nutze sie als **Stil-Referenz** für Ton, Struktur, typische Formulierungen und Themen. **Kopiere keine Formulierungen wörtlich.**",
    );
    const byChannel = new Map<Channel, SourcePost[]>();
    for (const s of samples) {
      const list = byChannel.get(s.channel) ?? [];
      list.push(s);
      byChannel.set(s.channel, list);
    }
    for (const ch of selectedChannels) {
      const list = byChannel.get(ch);
      if (!list?.length) continue;
      parts.push(`### ${CHANNEL_LABELS[ch]}`);
      for (const s of list) {
        const excerpt = s.body.slice(0, POST_EXCERPT_LEN);
        const header = [
          s.title ? `**${s.title}**` : null,
          s.is_featured ? "★ Featured" : null,
          s.url ? `(${s.url})` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        parts.push(
          (header ? header + "\n" : "") +
            excerpt +
            (s.body.length > POST_EXCERPT_LEN ? "\n[…gekürzt]" : ""),
        );
      }
    }
  }

  // Per-Kanal Anweisungen
  parts.push(
    "## Kanal-spezifische Anweisungen",
    "Für jeden Kanal gelten ZUSÄTZLICH zu den allgemeinen Regeln diese Feinjustierungen:",
  );
  for (const ch of selectedChannels) {
    const cv = channelBrandVoices[ch];
    const lines: string[] = [`### ${CHANNEL_LABELS[ch]}`];
    lines.push(`- **Basis-Regel**: ${DEFAULT_CHANNEL_RULES[ch]}`);
    if (cv?.tone) lines.push(`- **Ton**: ${cv.tone}`);
    if (cv?.length_guideline)
      lines.push(`- **Länge**: ${cv.length_guideline}`);
    if (cv?.cta_style) lines.push(`- **CTA-Stil**: ${cv.cta_style}`);
    if (cv?.specific_dos?.length) {
      lines.push("- **Zusätzliche Do's**:");
      for (const d of cv.specific_dos) lines.push(`  - ${d}`);
    }
    if (cv?.specific_donts?.length) {
      lines.push("- **Zusätzliche Don'ts**:");
      for (const d of cv.specific_donts) lines.push(`  - ${d}`);
    }
    if (cv?.notes) lines.push(`- **Notiz**: ${cv.notes}`);
    parts.push(lines.join("\n"));
  }

  parts.push(
    "## Auftrag",
    `Liefere ausschließlich Content für die folgenden Kanäle: ${selectedChannels
      .map((c) => CHANNEL_LABELS[c])
      .join(", ")}.`,
    "Antworte strikt im vorgegebenen JSON-Schema. Kein Markdown außerhalb der Felder.",
  );

  return parts.join("\n\n");
}

const DEFAULT_CHANNEL_RULES: Record<Channel, string> = {
  linkedin:
    "Professionell, B2B, Hook in den ersten 2 Zeilen. 3-5 Hashtags, keine Emoji-Flut. Max. 3000 Zeichen.",
  instagram:
    "Visuell orientiert, persönlich, 1-3 Emojis. 10-15 Hashtags. Max. 2200 Zeichen.",
  eyefox:
    "Sachlich-informativ, B2B-Partnerseite für Augenarztpraxen, 200-500 Wörter.",
  newsletter:
    "Betreff max. 55 Zeichen, Preheader ergänzt den Betreff, strukturierter HTML-Body mit h2, p, ul, a, strong und einem klaren CTA.",
  blog: "SEO-optimiert. Titel mit Keyword, strukturiert mit h2/h3/h4, 600-1000 Wörter, Meta-Description 140-160 Zeichen, 3-6 Tags.",
};

export function buildUserPrompt(input: BuildPromptInput): string {
  const { topic, brief } = input;

  const parts: string[] = [`# Thema\n${topic}`];
  if (brief) parts.push(`# Briefing\n${brief}`);

  parts.push(
    "# Auftrag",
    "Erzeuge jetzt den Content für die im System-Prompt genannten Kanäle im vorgegebenen JSON-Schema.",
  );

  return parts.join("\n\n");
}
