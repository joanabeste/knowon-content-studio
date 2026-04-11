import type { BrandVoice, GoldenExample, SourcePost } from "@/lib/supabase/types";

export interface BuildPromptInput {
  topic: string;
  brief: string | null;
  brandVoice: BrandVoice | null;
  goldenExamples: GoldenExample[];
  sourcePosts?: SourcePost[];
}

export function buildSystemPrompt(input: BuildPromptInput): string {
  const { brandVoice, goldenExamples } = input;

  const parts: string[] = [];

  parts.push(
    "Du bist der Marketing-Content-Generator für KnowOn (https://www.knowon.de), eine Online-Lernplattform.",
    "Deine Aufgabe: aus einem Thema + Briefing passgenaue Content-Varianten für LinkedIn, Instagram, die Eyefox-Partnerseite, den Newsletter und den WordPress-Blog erzeugen — in einem Rutsch, alle im gleichen Stil.",
    "Antworte IMMER im vorgegebenen JSON-Schema. Keine Erklärungen außerhalb des JSON.",
    "Sprache: Deutsch (Du-Form, außer Brand-Voice sagt etwas anderes).",
  );

  if (brandVoice?.about_knowon) {
    parts.push("## Über KnowOn", brandVoice.about_knowon);
  }

  if (brandVoice?.tone) {
    parts.push("## Tonfall", brandVoice.tone);
  }

  if (brandVoice?.audience) {
    parts.push("## Zielgruppe", brandVoice.audience);
  }

  if (brandVoice?.dos?.length) {
    parts.push("## Do's", brandVoice.dos.map((d) => `- ${d}`).join("\n"));
  }

  if (brandVoice?.donts?.length) {
    parts.push("## Don'ts", brandVoice.donts.map((d) => `- ${d}`).join("\n"));
  }

  if (goldenExamples.length) {
    parts.push("## Beispielhafte Beiträge (Golden Examples)");
    for (const ex of goldenExamples) {
      parts.push(
        `### Kanal: ${ex.channel}${ex.title ? ` — ${ex.title}` : ""}`,
        ex.body,
      );
    }
  }

  parts.push(
    "## Kanal-Regeln",
    "- **LinkedIn**: professionell, B2B, erste 2 Zeilen = Hook. 3-6 Hashtags, keine Emoji-Flut. Max 3000 Zeichen.",
    "- **Instagram**: visuell-orientiert, persönlicher, mit 1-3 passenden Emojis. 10-20 Hashtags. Max 2200 Zeichen.",
    "- **Eyefox**: branchenspezifischer Partnerseiten-Text für Augenoptiker*innen. Sachlich, informativ, 200-500 Wörter.",
    "- **Newsletter**: Betreff max 60 Zeichen (klickstark), Preheader ergänzt den Betreff, HTML-Body mit Überschriften, Absätzen und CTA-Link.",
    "- **Blog**: SEO-optimiert. Titel mit Keyword, gut strukturierter HTML-Body mit H2/H3/Listen, 500-900 Wörter, Meta-Description 140-160 Zeichen.",
  );

  return parts.join("\n\n");
}

export function buildUserPrompt(input: BuildPromptInput): string {
  const { topic, brief, sourcePosts } = input;

  const parts: string[] = [
    `# Thema\n${topic}`,
  ];
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
    "Erzeuge jetzt den Content für alle fünf Kanäle im vorgegebenen JSON-Schema. Der Kern ist jeweils dasselbe Thema, die Form ist kanaltypisch unterschiedlich.",
  );

  return parts.join("\n\n");
}
