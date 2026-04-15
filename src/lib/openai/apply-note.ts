import { getOpenAI, OPENAI_TEXT_MODEL } from "./client";

/**
 * Uses GPT to integrate a reviewer note into the existing variant
 * body. Returns just the rewritten body — no metadata shift, no
 * structural changes. The caller snapshots the old body into
 * variant_versions before writing the new body.
 *
 * We keep the prompt conservative: only ask the model to *integrate*
 * the note, not to rewrite the whole thing. That way a short note
 * like "CTA fehlt" makes a surgical change rather than a full rewrite.
 */
export async function applyNoteToBody(opts: {
  body: string;
  note: string;
  channelLabel: string;
}): Promise<{ body: string } | { error: string }> {
  const { body, note, channelLabel } = opts;

  if (!note.trim()) return { error: "Notiz ist leer." };
  if (!body.trim()) return { error: "Variante hat keinen Inhalt." };

  const system = [
    "Du überarbeitest Marketing-Content anhand konkreter Review-Notizen.",
    "Arbeite die Notiz so minimalinvasiv wie möglich in den bestehenden Text ein.",
    "Behalte Tonalität, Struktur, Formatierung (HTML/Markdown) und Länge bei.",
    "Füge nichts hinzu, was nicht in der Notiz steht oder logisch aus ihr folgt.",
    "Gib AUSSCHLIESSLICH den überarbeiteten Text zurück — keine Meta-Kommentare, keine Erklärungen.",
  ].join("\n");

  const user = [
    `# Kanal\n${channelLabel}`,
    `# Aktueller Text\n${body}`,
    `# Review-Notiz\n${note}`,
    "# Auftrag\nGib den überarbeiteten Text vollständig zurück.",
  ].join("\n\n");

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: OPENAI_TEXT_MODEL,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return { error: "Leere Antwort vom Modell." };
    return { body: text };
  } catch (err) {
    console.error("[applyNoteToBody] OpenAI error", err);
    return {
      error:
        "Einarbeitung fehlgeschlagen. Prüfe OPENAI_API_KEY oder versuche es erneut.",
    };
  }
}
