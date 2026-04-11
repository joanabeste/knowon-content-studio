#!/usr/bin/env node
/**
 * Seeds the KnowOn brand voice (general + per-channel) based on an
 * analysis of knowon.de (fetched via WP REST API).
 *
 * Usage:
 *   npm run seed:brand
 *
 * Idempotent — re-running just updates the rows.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen.\n" +
      "Stelle sicher, dass .env.local befuellt ist.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const GENERAL = {
  tone: `Professionell-warmherzig, sachlich-strukturiert, B2B. Klar, hochwertig wirkend, nie clickbait. Kompetent, aber nicht arrogant.`,
  audience: `Augenarztpraxen und ihr Team: MFAs, Quereinsteiger:innen in die Augenheilkunde, Azubis, Praxismanagement, Ärzt:innen. Ziel: Wissen aufbauen, direkt im Praxisalltag anwenden, Einarbeitung strukturieren.`,
  about_knowon: `KnowOn ist eine Online-Lernplattform für digitale Weiterbildung in der Augenheilkunde, gegründet von Nadine Dyck mit Sitz in Minden. Angebote: eLearning-Kurse (Anatomie, Optik, Katarakt, Glaukom, Contactlinsen, Notfälle, OCT, refraktive Chirurgie), Webinare, strukturierte Azubi- und Quereinsteiger-Programme, Spezialisierungsqualifikation Augenheilkunde. Mission: Fachwissen in der Augenheilkunde besser vermitteln.`,
  dos: [
    `Gender-gerechte Schreibweise (Ärzt:innen, Patient:innen, Mitarbeitende)`,
    `Zielgruppe direkt nennen (Praxisteams, MFAs, Azubis, Quereinsteiger:innen)`,
    `Praxis-Nutzen konkret machen (z.B. „direkt im Alltag anwendbar")`,
    `Kernkeywords verwenden: praxisnah, hochwertig, strukturiert, nachhaltig, Mehrwert, Kompetenz`,
    `Win-Win betonen: Praxis UND Mitarbeitende profitieren`,
    `Expertise zeigen ohne zu dozieren`,
    `Partner/Kooperationen namentlich nennen, wenn relevant`,
  ],
  donts: [
    `NIEMALS „Augenoptiker" — KnowOn richtet sich an Augenarztpraxen, nicht an Optiker-Fachgeschäfte`,
    `Kein Clickbait wie „Du glaubst nicht, was..."`,
    `Keine übertriebenen Versprechen wie „In 3 Tagen zum Experten"`,
    `Keine generischen Werbephrasen, die zu jeder Branche passen würden`,
    `Keine Emoji-Flut — max. 1–2, nur wenn passend`,
    `Keine trockene Fach-Sprache ohne Praxisbezug`,
  ],
};

const CHANNELS = {
  linkedin: {
    tone: `Professionell-persönlich, Hook in den ersten 2 Zeilen. Kompetent auftreten, gern Gründerinnen-Perspektive (Nadine Dyck).`,
    length_guideline: `600-1500 Zeichen, 3-5 Hashtags.`,
    cta_style: `Subtil, am Ende: „Mehr erfahren: knowon.de" oder Frage an die Community.`,
    specific_dos: [
      `Mit Frage, Insight oder persönlicher Beobachtung öffnen`,
      `Zahlen/Fakten wenn verfügbar`,
      `Echtes Storytelling statt reines Produkt-Pitch`,
      `Partner/Kolleg:innen namentlich nennen bei Kooperationen`,
    ],
    specific_donts: [
      `Kein reines Produkt-Pitch`,
      `Keine Hashtag-Flut (>5)`,
      `Keine generischen Motivationsphrasen`,
    ],
    notes: `Typischer Blueprint für KnowOn-Corporate-News: Anforderung → Partner-Vorstellung → KnowOn-Beitrag → Warum wichtig → Blick nach vorn.`,
  },
  instagram: {
    tone: `Nahbarer und persönlicher als LinkedIn. 1-3 passende Emojis OK. Visuell denken — die Caption ergänzt das Bild.`,
    length_guideline: `200-900 Zeichen Caption, 10-15 relevante Hashtags.`,
    cta_style: `„Link in Bio", „Speichere dir den Post", Frage an die Community.`,
    specific_dos: [
      `Emotional öffnen`,
      `Menschen zeigen (Team, Kund:innen-Praxen)`,
      `Kurze Absätze mit Leerzeilen`,
      `Hashtag-Block am Ende, visuell vom Text getrennt`,
    ],
    specific_donts: [
      `Keine Wall of Text`,
      `Keine unerklärten Fachbegriffe`,
      `Keine medizinischen Behandlungsversprechen`,
    ],
    notes: null,
  },
  eyefox: {
    tone: `Sachlich-informativ, B2B-Partnerseiten-Ton für Augenarztpraxen. Kein Social-Media-Spin.`,
    length_guideline: `200-500 Wörter, strukturiert mit kurzen Absätzen.`,
    cta_style: `Klar am Ende: „Kontakt über knowon.de/kontakt" oder „Jetzt informieren".`,
    specific_dos: [
      `Nutzen für Augenarztpraxen klar benennen`,
      `Produkte/Kurse konkret nennen`,
      `Kontaktweg am Ende`,
    ],
    specific_donts: [
      `Keine Emojis`,
      `Kein Social-Media-Ton`,
      `Keine Hashtags`,
    ],
    notes: null,
  },
  newsletter: {
    tone: `Direkte, warme Ansprache „Liebes Praxisteam" / „Liebe Kolleg:innen". Eine Kernbotschaft pro Mail.`,
    length_guideline: `Betreff <55 Zeichen, Preheader 80-120 Zeichen, HTML-Body mit klarer Struktur (h2, p, ul, a, strong).`,
    cta_style: `Ein Haupt-CTA pro Mail, als Button oder starker Link.`,
    specific_dos: [
      `Personalisierter Einstieg („Liebes Praxisteam")`,
      `Klare Struktur mit Zwischenüberschriften`,
      `Ein Haupt-CTA`,
      `Kurze Absätze`,
    ],
    specific_donts: [
      `Kein Clickbait-Betreff`,
      `Keine Mega-Mail — eine Kernbotschaft reicht`,
      `Kein reiner Werbe-Ton ohne Mehrwert`,
    ],
    notes: null,
  },
  blog: {
    tone: `Informativ, strukturiert, SEO-freundlich. Fachbegriffe erklären, gern mit historischen oder statistischen Fakten anreichern.`,
    length_guideline: `600-1000 Wörter, Meta-Description 140-160 Zeichen, 3-6 Tags.`,
    cta_style: `Am Ende dezenter Verweis auf knowon.de/produkt/... oder die Kontaktseite.`,
    specific_dos: [
      `Fachwissen mit konkretem Praxisbezug verknüpfen`,
      `SEO-Keyword natürlich einbauen`,
      `Historische oder statistische Fakten einstreuen (z.B. weltweit tragen 125 Mio. Menschen Contactlinsen)`,
      `Einzelne Keywords fett markieren`,
      `Strukturierung mit h2/h3/h4 und kurzen Absätzen`,
    ],
    specific_donts: [
      `Keine unerklärten Fachbegriffe`,
      `Keine reinen Werbetexte`,
      `Keine Zahlen ohne Quelle`,
    ],
    notes: `KnowOn nutzt auf der Website H4 als Zwischenüberschriften in Blogposts und markiert einzelne Keywords inline fett.`,
  },
};

async function main() {
  console.log("→ Updating brand_voice (general)…");
  const { error: bvErr } = await supabase
    .from("brand_voice")
    .update({
      tone: GENERAL.tone,
      audience: GENERAL.audience,
      about_knowon: GENERAL.about_knowon,
      dos: GENERAL.dos,
      donts: GENERAL.donts,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (bvErr) {
    console.error("brand_voice update failed:", bvErr.message);
    process.exit(1);
  }
  console.log("  ✓ General brand voice updated");

  for (const [channel, data] of Object.entries(CHANNELS)) {
    console.log(`→ Upserting channel_brand_voice (${channel})…`);
    const { error } = await supabase
      .from("channel_brand_voice")
      .upsert(
        {
          channel,
          tone: data.tone,
          length_guideline: data.length_guideline,
          cta_style: data.cta_style,
          specific_dos: data.specific_dos,
          specific_donts: data.specific_donts,
          notes: data.notes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "channel" },
      );
    if (error) {
      console.error(`channel_brand_voice (${channel}) failed:`, error.message);
      process.exit(1);
    }
    console.log(`  ✓ ${channel}`);
  }

  console.log("\n✅ Brand Voice geseedet. KnowOn-Ton ist jetzt aktiv.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
