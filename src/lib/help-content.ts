import {
  Sparkles,
  Layout,
  FolderOpen,
  CheckCircle2,
  BookOpen,
  FileText,
  Mic,
  Send,
  Users,
  Lightbulb,
  Brain,
  ShieldCheck,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";

/**
 * Content for the global help panel (see src/components/help-panel.tsx).
 *
 * Kept as code (not markdown/CMS) so it's versioned alongside the
 * features — whoever adds a feature also updates the matching help
 * entry in the same PR. Factored out of the component file so the
 * component stays focused on UI concerns.
 *
 * Template literals (backticks) are used throughout so German
 * typographic quotes („…") inside the content can't accidentally
 * terminate a JS string.
 */
export type HelpSection = {
  id: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  steps: (string | { heading: string; body: string })[];
};

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "overview",
    icon: Layout,
    title: "Überblick",
    summary: "Wie die App aufgebaut ist und was wohin gehört.",
    steps: [
      `Links findest du die Navigation: Dashboard, Erzeugen, Projekte, Review + Bibliothek (Inspiration, Wissen) + Einstellungen (nur für Admins).`,
      `Oben rechts dieses Hilfe-Icon — hier kannst du jederzeit nachschlagen.`,
      `Der typische Ablauf ist: Thema + Briefing eingeben → Content wird für alle gewählten Kanäle generiert → im Projekt bearbeiten → in Review → freigeben → veröffentlichen.`,
      `Jede freigegebene Variante fließt automatisch zurück in die Inspirations-Bibliothek als Featured-Beispiel — dadurch wird die nächste Generierung besser.`,
    ],
  },
  {
    id: "generate",
    icon: Sparkles,
    title: "Content erzeugen",
    summary: "Von der Idee zum fertigen Entwurf in unter einer Minute.",
    steps: [
      {
        heading: "1. Kanäle auswählen",
        body: `Auf „Erzeugen" klicken. Oben wählst du die Kanäle aus, für die GPT Content erzeugen soll: LinkedIn, Instagram, Eyefox, Newsletter, WordPress. Mehrere gleichzeitig sind der Normalfall — alle werden aus demselben Briefing erzeugt und bleiben thematisch konsistent.`,
      },
      {
        heading: "2. Thema + Briefing",
        body: `Thema ist eine Zeile („Neuer eLearning-Kurs XY"). Briefing ist das Futter für GPT: Kernbotschaft, Zielgruppe, Fakten, Ton, CTA. Je konkreter, desto besser der Output. Der Placeholder im Briefing-Feld zeigt die erwartete Struktur.`,
      },
      {
        heading: "3. Generieren",
        body: `Klick auf „Content für X Kanäle erzeugen". Die Generierung dauert 20–40 Sekunden. Bleib in dem Tab, nicht zurücknavigieren. Danach landest du automatisch im Projekt-Detail.`,
      },
    ],
  },
  {
    id: "projects",
    icon: FolderOpen,
    title: "Projekte bearbeiten",
    summary: "Varianten editieren, Hashtags pflegen, Notizen hinterlassen.",
    steps: [
      `Jedes Projekt enthält pro Kanal eine Variant-Card. Klick auf den Kanal-Tab, um zwischen den Varianten zu wechseln.`,
      `Der Button „Bearbeiten" macht Text + Hashtags / Tags / Kategorien editierbar. „Speichern" persistiert, „Abbrechen" verwirft.`,
      `Bei Blog-Varianten kannst du Titel, Slug, Meta-Description, Tags und Kategorien direkt im UI pflegen. Vorhandene WordPress-Kategorien werden unterhalb des Input-Felds als Quick-Pick-Chips angezeigt.`,
      `„Mögliche Hashtags" sind GPT-Vorschläge — komma-getrennt editierbar.`,
      `„Interne Notizen" unten auf jeder Card sind fürs Team gedacht: schnelle Kommentare wie „Abklären mit Dr. Müller". Jeder Team-User kann lesen und schreiben, nur der Autor der Notiz (oder ein Admin) kann sie löschen.`,
    ],
  },
  {
    id: "review",
    icon: CheckCircle2,
    title: "Review-Workflow",
    summary: "Wie Varianten den Weg von Entwurf zur Veröffentlichung gehen.",
    steps: [
      `Neue Varianten starten als „Entwurf". Der Status wird oben in der Card als farbiges Pill angezeigt: grau = Entwurf, amber = In Review, teal = Freigegeben, lila = Veröffentlicht.`,
      `„Zur Review" schickt die Variante an die Review-Queue (Sidebar → Review). Reviewer können dort freigeben oder zurück in den Entwurf schicken.`,
      `Admin und Editor können den Status über das Dropdown auch direkt auf jeden beliebigen Wert setzen — z.B. um einen veröffentlichten Post wieder in Entwurf zurückzuholen. Reviewer können alles außer „Veröffentlicht" setzen.`,
      `Sobald eine Variante auf „Freigegeben" steht, wird sie automatisch als Featured-Beispiel in die Inspirations-Bibliothek geschrieben. Sie beeinflusst damit alle zukünftigen Generierungen im selben Kanal — das System lernt deinen redaktionellen Stil.`,
    ],
  },
  {
    id: "library",
    icon: BookOpen,
    title: "Inspirations-Bibliothek",
    summary: "Alte KnowOn-Posts als Stil-Referenz für GPT.",
    steps: [
      `Die Bibliothek (Sidebar → Inspiration) enthält alte Posts, die GPT als Stil-Beispiele bekommt. Pro Generierung werden die 4 relevantesten pro Kanal ausgewählt, sortiert nach Featured-Status und Datum.`,
      `Quellen hinzufügen: oben auf „Quellen hinzufügen" klicken, dann wählen zwischen „Sync" (automatisch von WordPress oder Eyefox), „URL-Import" (öffentliche LinkedIn-/Instagram-/Blog-URLs einfügen) oder „Manuell" (eigenen Text einfügen).`,
      `„Featured" (Stern-Icon) markiert Posts, die GPT bevorzugt als Beispiel nimmt. Nutze das für deine besten Referenz-Texte.`,
      `Bulk-Actions: mehrere Posts auswählen und in einem Rutsch featured setzen oder löschen.`,
      `Der Cron-Job synchronisiert die Feeds einmal täglich automatisch — manuell synchronisieren kannst du aber jederzeit über „Sync" in den Integrationen.`,
    ],
  },
  {
    id: "knowledge",
    icon: FileText,
    title: "Wissen (Kontext-Dokumente)",
    summary: "Zusatz-Wissen, das in jeden Prompt einfließt.",
    steps: [
      `Sidebar → Wissen. Hier kannst du PDFs, Präsentationen oder Textdokumente hochladen, die GPT bei jeder Generierung als Kontext mitbekommt.`,
      `Im Gegensatz zur Bibliothek sind das keine Stil-Referenzen, sondern Fakten-Quellen: Studien, interne Briefings, Produktdetails, Vorträge.`,
      `Nur Dokumente mit Schalter „Aktiv" werden in den Prompt gesetzt. Lade ruhig mehr hoch als du aktiv nutzt — du kannst je nach Projekt einzelne aktivieren und deaktivieren.`,
    ],
  },
  {
    id: "brand",
    icon: Mic,
    title: "Brand Voice konfigurieren",
    summary: "Wie du den KnowOn-Ton hart an GPT übergibst.",
    steps: [
      `Einstellungen → Brand Voice. Der „Allgemein"-Tab gilt für alle Kanäle, die Kanal-Tabs überschreiben oder ergänzen einzelne Aspekte.`,
      `„Tonfall-Beispiele": Ein Freitext-Feld, in das du 3–8 perfekte Beispielsätze kopierst („So klingen wir wirklich"). Dieser Block wird in jeden Generierungs-Prompt hart verankert und rotiert nicht — der stärkste Hebel für konsistenten Ton.`,
      `„Do's" und „Don'ts": stichpunktartig, ein Eintrag pro Zeile. Fließen direkt in den System-Prompt.`,
      `Brand-Logo: Das Logo, das unten rechts in jedes generierte oder hochgeladene Beitragsbild eingeblendet wird. PNG mit Transparenz ist ideal, max 2 MB. 1:1-Einblendung ohne Umfärbung.`,
    ],
  },
  {
    id: "publish",
    icon: Send,
    title: "In WordPress veröffentlichen",
    summary: "Blog-Variante direkt nach WordPress pushen.",
    steps: [
      `Voraussetzung: In Einstellungen → Integrationen müssen die WordPress-Zugangsdaten (Base-URL + Application Password) hinterlegt und verbunden sein.`,
      `In einer Blog-Variante, die auf „Freigegeben" oder „Veröffentlicht" steht, erscheint unten das „Nach WordPress senden"-Panel.`,
      `Drei Modi: „Entwurf" (WP legt einen Draft an, den du manuell live setzt), „Geplant" (WP veröffentlicht zum angegebenen Datum automatisch) und „Sofort live" (sofort publiziert).`,
      `Titel, Slug, Meta-Description, Tags und Kategorien werden aus der Variant-Metadata übernommen. Das Beitragsbild kommt aus dem ersten is_featured-Bild im Projekt — oder, wenn keins gesetzt ist, aus dem zuletzt generierten.`,
      `Bestehende WP-Posts werden aktualisiert statt dupliziert, wenn du die Variante erneut sendest — die WP-Post-ID wird in der Metadata gespeichert.`,
    ],
  },
  {
    id: "images",
    icon: Layout,
    title: "Beitragsbilder",
    summary: "Blog-Hero-Bilder mit KI erzeugen oder hochladen.",
    steps: [
      `Auf dem Blog-Tab einer Variante öffnet sich oben das Bilder-Panel.`,
      `„Mit KI generieren": Prompt eingeben, gpt-image-1 erzeugt ein fotorealistisches Bild, sharp legt den KnowOn-Gradient-Overlay + Logo automatisch drüber.`,
      `„Eigenes Bild hochladen": PNG, JPG oder WebP bis 8 MB. Bekommt auch den Overlay + Logo verpasst, damit alles konsistent aussieht.`,
      `Das erste hochgeladene oder generierte Bild pro Projekt wird automatisch als „Beitragsbild" markiert. Über den Stern-Button kannst du jederzeit ein anderes als Featured setzen — das ist das Bild, das beim WordPress-Publish mitgesendet wird.`,
    ],
  },
  {
    id: "team",
    icon: Users,
    title: "Team & Berechtigungen",
    summary: "Rollen, Passwörter, Nutzer-Verwaltung.",
    steps: [
      `Einstellungen → Team. Nur Admins sehen diesen Bereich.`,
      `Drei Rollen: Admin (alles), Editor (Inhalte erzeugen, bearbeiten, publishen) und Reviewer (nur bestehende Varianten prüfen und freigeben, nicht selbst bearbeiten).`,
      `Neuer Nutzer wird direkt mit Passwort angelegt — kein E-Mail-Versand, keine Bestätigung. Den „Generieren"-Button neben dem Passwort-Feld nutzen, um ein starkes 16-Zeichen-Passwort zu erzeugen, über das Auge-Icon sichtbar machen, über das Kopier-Icon in die Zwischenablage.`,
      `Rollen können jederzeit per Dropdown in der Nutzer-Liste geändert werden.`,
    ],
  },
  {
    id: "tips",
    icon: Lightbulb,
    title: "Tipps für bessere Ergebnisse",
    summary: "Kleine Hebel mit großer Wirkung auf die Output-Qualität.",
    steps: [
      `Kurze, konkrete Briefings schlagen lange vage Briefings. Nenne die Kernbotschaft in einem Satz, dann 3–5 Fakten.`,
      `Pflege die „Tonfall-Beispiele" in der Brand Voice — das ist der stärkste Ton-Anker und kostet dich nur einmal ein paar Minuten.`,
      `Markiere deine besten echten Posts in der Inspirations-Bibliothek als „Featured". GPT nimmt sie bevorzugt als Few-Shot-Beispiele.`,
      `Freigegebene Varianten werden automatisch zu Featured-Quellen — je mehr du nutzt und freigibst, desto besser passt der Output auf deinen Stil. Das System lernt aus deiner redaktionellen Arbeit.`,
      `Wenn ein Output nicht passt: kleine Änderung am Briefing (spezifischer Hook, anderes Fakt) und neu generieren. Schneller als den Text manuell umzuschreiben.`,
    ],
  },
  {
    id: "ki-training",
    icon: Brain,
    title: "Wie die KI deinen Stil lernt",
    summary:
      "Kein klassisches Training — sondern ein System, das mit jeder Freigabe besser wird.",
    steps: [
      {
        heading: "Das Grundprinzip",
        body: `GPT wird NICHT im klassischen Sinn fine-getuned. Stattdessen baut das System bei jeder Generierung frisch einen Prompt zusammen, der GPT erklärt „so klingt KnowOn". Je besser dieser Prompt, desto besser der Output. Alles was du in Brand Voice, Bibliothek und Wissen einträgst, landet als Teil dieses Prompts in jeder einzelnen Generierung.`,
      },
      {
        heading: "Säule 1: Brand Voice (hart verankert)",
        body: `Tonfall, Zielgruppe, Do's/Don'ts und vor allem die „Tonfall-Beispiele" werden IMMER in den System-Prompt gesetzt, bei jeder Generierung. Das ist der stabile Kern — eine Art hart verdrahtete Stil-Leitplanke, die GPT nie vergisst.`,
      },
      {
        heading: "Säule 2: Inspirations-Bibliothek (dynamische Beispiele)",
        body: `Aus der Bibliothek werden pro Generierung die 4 relevantesten Posts PRO KANAL ausgewählt — sortiert nach Featured-Status und Aktualität. GPT liest sie als „so haben wir sowas in der Vergangenheit gemacht" und imitiert Rhythmus, Satzbau und Wortwahl. Es kopiert NICHT wörtlich (das ist explizit im Prompt verboten).`,
      },
      {
        heading: "Säule 3: Kontext-Dokumente (Faktenbasis)",
        body: `Alle aktiven Dokumente aus der Bibliothek „Wissen" landen als zusätzlicher Kontext im Prompt. GPT kennt damit interne Details, Produktdaten, Studien — Dinge, die es aus seinem eigenen Training nicht wissen kann.`,
      },
      {
        heading: `Der Feedback-Loop — das eigentliche „Training"`,
        body: `Sobald eine Variante den Status „Freigegeben" bekommt, wird sie automatisch als Featured-Post in die Inspirations-Bibliothek geschrieben. Damit wird sie ab sofort als Few-Shot-Beispiel in zukünftige Generierungen aufgenommen. Effekt: je mehr du redaktionell freigibst, desto stärker lernt das System deinen echten Stil — weil GPT immer mehr deiner bereits geprüften Texte als Referenz sieht, statt nur importierter Altbestand.`,
      },
      {
        heading: "Warum kein klassisches Fine-Tuning?",
        body: `Fine-Tuning würde mindestens 200+ geprüfte Beispiele verlangen, wäre teuer, nicht erklärbar und bei jeder Brand-Voice-Änderung neu nötig. Der aktuelle Ansatz ist vollständig transparent (du siehst exakt, was GPT bekommt), sofort änderbar (Brand Voice-Update = nächste Generierung nutzt die neue Version) und kostet nichts Extra.`,
      },
      {
        heading: "So machst du es besser, schneller",
        body: `(1) Tonfall-Beispiele in der Brand Voice pflegen. (2) Die besten alten Posts in der Bibliothek als Featured markieren. (3) Konsequent freigeben statt abbrechen — jeder „Freigegeben"-Klick bringt das System einen Schritt näher an deinen Stil.`,
      },
    ],
  },
  {
    id: "data",
    icon: ShieldCheck,
    title: "Daten & Technik im Hintergrund",
    summary:
      "Wo deine Daten liegen, wer sie sieht und was an externe Dienste geht.",
    steps: [
      {
        heading: "Wo liegen die Daten?",
        body: `Sämtliche Daten — Projekte, Varianten, Quellen, Notizen, Bilder, Brand Voice, User-Konten — leben in Supabase (Postgres + Storage), hosted in der EU. Die Anwendung selbst läuft auf Vercel. Beides sind professionelle Anbieter mit DSGVO-konformem Betrieb.`,
      },
      {
        heading: "Was wird an OpenAI gesendet?",
        body: `Bei jeder Generierung schickt der Server einen Prompt an OpenAI, der enthält: dein Thema, dein Briefing, die Brand Voice (Tonfall, Do's/Don'ts, Beispiele), bis zu 30 ausgewählte Inspirations-Posts pro Kanal, alle aktiven Kontext-Dokumente und die Kanal-Regeln. Kein Passwort, keine Auth-Tokens, keine WordPress-Credentials, keine Daten anderer Teams oder User.`,
      },
      {
        heading: "Speichert OpenAI meine Daten?",
        body: `Bei der OpenAI-API gilt: Anfragen werden standardmäßig 30 Tage zum Missbrauchs-Monitoring gespeichert, danach gelöscht. Deine Inhalte werden NICHT fürs Modell-Training verwendet — das ist der entscheidende Unterschied zur ChatGPT-Consumer-App. Siehe die OpenAI Enterprise Data Privacy Policy.`,
      },
      {
        heading: "Wie sind die WordPress-Zugangsdaten gespeichert?",
        body: `Die WP-Application-Password wird AES-256-GCM verschlüsselt in der DB abgelegt (Key via Env-Variable INTEGRATIONS_ENCRYPTION_KEY). Beim Publizieren wird sie kurz entschlüsselt, an die WP-REST-API gesendet, dann wieder verworfen. Keine Klartext-Speicherung.`,
      },
      {
        heading: "Wer kann was sehen (RLS)?",
        body: `Alle Schreib-Zugriffe laufen durch Server Actions, die den User + die Rolle prüfen. Zusätzlich hat Supabase Row Level Security auf den sensiblen Tabellen. Admins sehen alles, Editoren sehen alle Projekte und können sie bearbeiten, Reviewer können Varianten prüfen aber nicht selbst editieren.`,
      },
      {
        heading: "RSS-Sync & Cron",
        body: `Ein Vercel-Cron-Job läuft täglich um 06:00 UTC und holt neue Einträge aus allen aktiven RSS-Feeds. Der Cron-Endpoint ist mit einem CRON_SECRET gesichert — unautorisierte Aufrufe werden mit 401 abgewiesen. Manueller „Sync all" funktioniert jederzeit über Einstellungen → Integrationen.`,
      },
      {
        heading: "URL-Importer & SSRF-Schutz",
        body: `Wenn du eine URL in die Bibliothek importierst, prüft der Server vorher, dass sie kein internes Ziel ist (keine 127.x, 10.x, 192.168.x, 169.254.x usw.) — sonst könnte ein Team-User versehentlich interne Cloud-Metadata-Endpunkte abrufen lassen. Das ist ein Schutz gegen SSRF-Angriffe.`,
      },
    ],
  },
  {
    id: "faq",
    icon: MessagesSquare,
    title: "Häufige Fragen",
    summary: "Schnelle Antworten auf typische Alltags-Fragen.",
    steps: [
      {
        heading: "Warum ist das Ergebnis jedes Mal anders, wenn ich neu generiere?",
        body: `Das ist Absicht. GPT läuft mit Temperatur 0.8, also mit bewusster Varianz — sonst würde jede Generierung deterministisch denselben Text produzieren. Wenn dir ein Ergebnis nicht passt: kleine Änderung am Briefing und neu laufen lassen. Oft reicht ein zweiter Durchlauf mit unverändertem Input schon für einen besseren Treffer.`,
      },
      {
        heading: "Wie viel kostet eine Generierung?",
        body: `Text-Generierung für alle 5 Kanäle zusammen: ~1–4 Cent (je nach Prompt-Länge). Ein KI-generiertes Blog-Beitragsbild bei quality=high: ~15–25 Cent. Das Haupt-Budget geht in Bilder, nicht Text. Für ~20 Projekte pro Monat sind das üblicherweise <5 €.`,
      },
      {
        heading: "Warum dauert die Bildgenerierung so lange?",
        body: `gpt-image-1 läuft mit quality=high — das ist langsamer als „medium" oder „auto", liefert dafür deutlich realistischere Fotos. Typisch: 30–60 Sekunden. Danach läuft noch die serverseitige Overlay-Komposition (Gradient + Logo), die ~1–2 Sekunden dauert.`,
      },
      {
        heading: "Werden meine Inhalte zum Trainieren des GPT-Modells verwendet?",
        body: `Nein. Die OpenAI-API (die wir hier nutzen) trainiert standardmäßig NICHT mit den Request-Daten. Das ist der wichtige Unterschied zur ChatGPT-Consumer-App. Deine Briefings und generierten Texte bleiben intern.`,
      },
      {
        heading: "Was passiert, wenn ich eine freigegebene Variante lösche?",
        body: `Die Variante und ihre Notizen sind weg. ABER: der Featured-Eintrag, der beim Freigeben automatisch in die Inspirations-Bibliothek geschrieben wurde, bleibt bestehen — er hat eine eigene Identität in source_posts und ist vom Original entkoppelt. Du müsstest ihn separat aus der Bibliothek löschen, falls gewünscht.`,
      },
      {
        heading: "Können zwei Leute gleichzeitig dasselbe Projekt bearbeiten?",
        body: `Technisch ja, aber es gibt kein Locking — wer zuletzt speichert, gewinnt. Für ein kleines Team ist das in der Praxis kein Problem. Nutze die internen Notizen auf jeder Variant-Card, um Arbeit untereinander asynchron abzustimmen („Ich nehme mir LinkedIn, schau du auf Instagram").`,
      },
      {
        heading: `Warum sehe ich die „Einstellungen"-Sektion nicht?`,
        body: `Die Sektion ist nur für Admins sichtbar. Wenn du Editor oder Reviewer bist, fehlt sie komplett — das ist so gewollt. Frag einen Admin, dich hochzustufen, falls du Brand Voice, Team oder Integrationen pflegen willst.`,
      },
      {
        heading: "Der Cron-Job läuft, aber ich sehe keine neuen Einträge — warum?",
        body: `Wahrscheinlichste Ursachen: (1) der Feed hat tatsächlich keine neuen Posts seit dem letzten Sync; (2) der Feed ist „Inaktiv" (Schalter in Integrationen); (3) CRON_SECRET ist in Vercel nicht gesetzt, dann lehnt der Endpoint alle Aufrufe ab. Check in Integrationen den Zeitstempel „Letzter Sync" pro Feed.`,
      },
      {
        heading: "Warum wird das Logo bei Bildern immer unten rechts eingeblendet?",
        body: `Die Bildpipeline ist so gebaut: erst generiert gpt-image-1 das Rohbild, dann legt der Server den KnowOn-Gradient-Overlay (lila → teal) darüber, dann das hochgeladene Brand-Logo 1:1 in die rechte untere Ecke. Keine Umfärbung, Transparenz bleibt erhalten. Willst du ein anderes Logo? Einfach in Brand Voice neu hochladen — ab der nächsten Generierung aktiv.`,
      },
      {
        heading: "Wie setze ich die Brand Voice zurück?",
        body: `Es gibt zwei Wege: (1) manuell alle Felder in Einstellungen → Brand Voice leeren/anpassen und speichern; (2) das mitgelieferte Seed-Script ausführen (\`npm run seed:brand\`) — das setzt die Brand Voice auf den mitgelieferten KnowOn-Default zurück.`,
      },
      {
        heading: "Kann ich einzelne Kanäle global deaktivieren?",
        body: `Im Moment nein — die Kanäle sind hartkodiert. Du kannst aber auf der Erzeugen-Seite für jedes einzelne Projekt nur einen Teil der Kanäle auswählen. Wenn du z.B. Eyefox nicht mehr benutzt, wähle ihn einfach nie an.`,
      },
    ],
  },
];
