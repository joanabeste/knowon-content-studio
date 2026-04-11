import type {
  BrandVoice,
  Channel,
  ChannelBrandVoice,
  GoldenExample,
  SourcePost,
} from "@/lib/supabase/types";
import { CHANNEL_LABELS } from "@/lib/supabase/types";

export interface BuildPromptInput {
  topic: string;
  brief: string | null;
  selectedChannels: Channel[];
  brandVoice: BrandVoice | null;
  channelBrandVoices: Partial<Record<Channel, ChannelBrandVoice>>;
  goldenExamples: GoldenExample[];
  sourcePosts?: SourcePost[];
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

export function buildSystemPrompt(input: BuildPromptInput): string {
  const {
    brandVoice,
    channelBrandVoices,
    goldenExamples,
    selectedChannels,
  } = input;

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
    parts.push("## Do's (allgemein)", brandVoice.dos.map((d) => `- ${d}`).join("\n"));
  }

  if (brandVoice?.donts?.length) {
    parts.push(
      "## Don'ts (allgemein)",
      brandVoice.donts.map((d) => `- ${d}`).join("\n"),
    );
  }

  // Golden Examples — nur pro gewähltem Kanal anhängen
  const examplesByChannel = goldenExamples.reduce<Record<string, GoldenExample[]>>(
    (acc, ex) => {
      (acc[ex.channel] ||= []).push(ex);
      return acc;
    },
    {},
  );
  const relevantExamples = selectedChannels.flatMap(
    (ch) => examplesByChannel[ch] ?? [],
  );
  if (relevantExamples.length) {
    parts.push("## Beispielhafte Beiträge (Golden Examples)");
    for (const ex of relevantExamples) {
      parts.push(
        `### Kanal: ${ex.channel}${ex.title ? ` — ${ex.title}` : ""}`,
        ex.body,
      );
    }
  }

  // Per-Kanal Anweisungen
  parts.push("## Kanal-spezifische Anweisungen");
  parts.push(
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

export function buildUserPrompt(input: BuildPromptInput): string {
  const { topic, brief, sourcePosts } = input;

  const parts: string[] = [`# Thema\n${topic}`];
  if (brief) parts.push(`# Briefing\n${brief}`);

  if (sourcePosts?.length) {
    parts.push("# Inspirations-Beiträge (nur als Stil-/Themenreferenz, NICHT kopieren)");
    for (const p of sourcePosts) {
      parts.push(
        `## ${p.title ?? "Untitled"}${p.url ? ` (${p.url})` : ""}\n${p.body.slice(0, 1500)}`,
      );
    }
  }

  parts.push(
    "# Auftrag",
    "Erzeuge jetzt den Content für die im System-Prompt genannten Kanäle im vorgegebenen JSON-Schema.",
  );

  return parts.join("\n\n");
}
