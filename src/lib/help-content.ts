import {
  Sparkles,
  Layout,
  FolderOpen,
  CheckCircle2,
  CalendarDays,
  BookOpen,
  Mic,
  Send,
  Settings as SettingsIcon,
  Brain,
  ShieldCheck,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";

/**
 * Content for the global help panel (see src/components/help-panel.tsx).
 *
 * FAQ-style: every entry is a concrete question with a short, plain
 * answer — written for marketing/editorial people, not developers.
 * Kept in code (not markdown/CMS) so it's versioned alongside the
 * features: whoever ships a feature updates the matching question
 * in the same PR.
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
    id: "start",
    icon: Layout,
    title: "Erste Schritte",
    summary: "Worum es hier geht und wie du loslegst.",
    steps: [
      {
        heading: "Was kann ich mit dieser App?",
        body: `Du kannst Marketing-Texte für alle KnowOn-Kanäle (LinkedIn, Instagram, Iprendo News, Eyefox, Newsletter, Blog) auf einen Schlag erzeugen lassen, im Team bearbeiten, freigeben und planen.`,
      },
      {
        heading: "Wo finde ich was?",
        body: `Links in der Navigation: „Dashboard" (Übersicht), „Erzeugen" (neuen Content starten), „Projekte" (alle Inhalte), „Kalender" (zeitliche Planung), „Review" (was auf Freigabe wartet). „Bibliothek" hat Inspirationsquellen + Wissen. „Einstellungen" ist nur für Admins sichtbar.`,
      },
      {
        heading: "Wie starte ich am besten?",
        body: `Klick auf „Erzeugen" in der Sidebar, wähle die Kanäle, beschreibe dein Thema, klick auf „Generieren". Nach ca. 30 Sekunden siehst du eine Vorschau — übernimmst sie oder lässt neu generieren.`,
      },
    ],
  },
  {
    id: "generate",
    icon: Sparkles,
    title: "Content erzeugen",
    summary: "Wie du aus einer Idee fertige Texte für jeden Kanal bekommst.",
    steps: [
      {
        heading: "Wie generiere ich Content?",
        body: `Auf „Erzeugen" klicken. Oben die Kanäle ankreuzen, für die du Inhalte brauchst. Dann das Thema in einem Satz nennen („Neuer Online-Kurs XY") und im Briefing ein paar Fakten ergänzen. Zum Schluss auf „Content erzeugen" klicken.`,
      },
      {
        heading: "Was soll ich ins Briefing schreiben?",
        body: `Kurz und konkret: Kernbotschaft in einem Satz, 3–5 wichtige Fakten, wer die Zielgruppe ist, was der Text bewirken soll (Klick, Anmeldung, Aufmerksamkeit). Je klarer das Briefing, desto besser die Texte.`,
      },
      {
        heading: `Was passiert nach dem Klick auf „Generieren"?`,
        body: `Die KI braucht ca. 20–40 Sekunden. Du landest dann auf einer Vorschau-Seite mit allen Texten. Dort hast du drei Möglichkeiten: „Übernehmen" (als Projekt speichern), „Alle neu generieren" (nochmal probieren, optional mit Zusatz-Anweisung) oder „Verwerfen" (alles löschen).`,
      },
      {
        heading: "Warum dauert das so lange?",
        body: `Die KI erzeugt alle Kanäle auf einmal — LinkedIn-Post, Instagram-Caption, Blog-Artikel usw. Das ist mehr Text, als es auf den ersten Blick aussieht. Bleib im Tab, die Generierung läuft weiter.`,
      },
    ],
  },
  {
    id: "edit",
    icon: FolderOpen,
    title: "Inhalte bearbeiten",
    summary: "Texte verfeinern, neu generieren, Versionen zurückholen.",
    steps: [
      {
        heading: "Wo finde ich meinen Content wieder?",
        body: `Unter „Projekte" in der Sidebar. Jedes Projekt bündelt alle Kanal-Varianten eines Themas. Klick auf ein Projekt, dann zwischen den Kanal-Tabs oben umschalten.`,
      },
      {
        heading: "Wie bearbeite ich einen Text?",
        body: `Auf der Projekt-Seite bei jeder Kanal-Karte oben rechts „Bearbeiten" klicken. Text und Hashtags werden editierbar. „Speichern" sichert die Änderung, „Abbrechen" verwirft sie.`,
      },
      {
        heading: "Wie lasse ich einen Text neu generieren?",
        body: `Auf einer Kanal-Karte den „Neu generieren"-Button oben nutzen. Optional kannst du der KI einen Zusatz-Wunsch mitgeben („kürzer", „ohne Emojis", „mehr Fokus auf Preis"). Der alte Text bleibt in der Historie abrufbar.`,
      },
      {
        heading: "Kann ich alle Kanäle auf einmal neu generieren?",
        body: `Ja. Oben in der Projekt-Leiste auf „Alle neu generieren" klicken. Du kannst auswählen, welche Kanäle mitsollen, und eine Zusatz-Anweisung mitgeben — z.B. „Datum überall weglassen", wenn sich die KI irgendwo vertan hat.`,
      },
      {
        heading: "Kann ich eine alte Version wiederherstellen?",
        body: `Ja. In jeder Kanal-Karte steht oben „v3 ↓" — ein Klick öffnet die Historie aller bisherigen Versionen. Jede lässt sich mit einem Klick zurückholen. Der aktuelle Text wird dabei automatisch als neue Version archiviert.`,
      },
      {
        heading: "Wie nutze ich den Zauberstab bei Notizen?",
        body: `Wenn jemand im Team eine Notiz hinterlässt („CTA fehlt" o.ä.), siehst du rechts daneben ein kleines Zauberstab-Symbol. Ein Klick arbeitet die Notiz per KI direkt in den Text ein. Der alte Text wird vorher archiviert.`,
      },
    ],
  },
  {
    id: "review",
    icon: CheckCircle2,
    title: "Review & Freigabe",
    summary: "Wie Inhalte vom Entwurf zum veröffentlichten Post werden.",
    steps: [
      {
        heading: "Wie schicke ich etwas zur Review?",
        body: `Auf der Projekt-Seite oben auf „In Review schicken" klicken. Im Fenster kannst du Kanäle abwählen, die du noch nicht fertig hast. Wähle optional eine Person als Reviewer — die bekommt den Eintrag dann prominent auf ihrem Dashboard.`,
      },
      {
        heading: "Wie erkenne ich, dass ich etwas prüfen soll?",
        body: `Wenn dir jemand Inhalte zur Review zugewiesen hat, siehst du oben auf dem Dashboard eine amber-farbige Karte „Auf dich wartet eine Freigabe". Ein Klick bringt dich direkt zum Projekt.`,
      },
      {
        heading: "Wie gebe ich Inhalte frei?",
        body: `Zwei Wege: (1) Kanal-weise über das Status-Dropdown auf jeder Kanal-Karte — direkt auf „Freigegeben" stellen. (2) Projekt-weise über den Button „Projekt freigeben" oben — gibt alle Kanäle frei, die gerade in Review stehen.`,
      },
      {
        heading: "Wie schicke ich etwas zurück in den Entwurf?",
        body: `Auf der Kanal-Karte das Status-Dropdown öffnen und auf „Entwurf" stellen. Ein Kommentar in den Notizen hilft dem Team zu verstehen, was noch fehlt.`,
      },
      {
        heading: "Wie markiere ich einen Post als veröffentlicht?",
        body: `Sobald der Post wirklich draußen ist: Status auf „Veröffentlicht" setzen. Das System füllt automatisch das Veröffentlichungsdatum aus und der Post erscheint im Kalender als erledigt.`,
      },
    ],
  },
  {
    id: "calendar",
    icon: CalendarDays,
    title: "Kalender & Planung",
    summary: "Zeitliche Planung aller Posts.",
    steps: [
      {
        heading: "Wie plane ich einen Post ein?",
        body: `Auf der Kanal-Karte gibt es ein Feld „Geplant für". Datum und Uhrzeit eintragen — der Post erscheint automatisch im Kalender am gewählten Tag.`,
      },
      {
        heading: "Wie verschiebe ich einen Post auf einen anderen Tag?",
        body: `Im Kalender (Sidebar → „Kalender") kannst du Posts per Drag-and-Drop auf einen anderen Tag ziehen. Das Datum wird automatisch angepasst.`,
      },
      {
        heading: "Wie filtere ich den Kalender?",
        body: `Oben im Kalender: Status (Entwurf, In Review, Freigegeben, Veröffentlicht), Kanal, Projekt oder zuständige Person. Mehrere Filter gleichzeitig sind möglich. „Alle zurücksetzen" leert die Auswahl.`,
      },
      {
        heading: "Was bedeuten die Ansichten Monat/Woche/Liste?",
        body: `Monat zeigt eine klassische Kalenderansicht, Woche zeigt nur 7 Tage mit mehr Platz pro Post, Liste sortiert alle Posts chronologisch untereinander — gut für mobile Nutzung.`,
      },
    ],
  },
  {
    id: "publish",
    icon: Send,
    title: "Veröffentlichen",
    summary: "Blog-Artikel nach WordPress senden, Beitragsbilder erstellen.",
    steps: [
      {
        heading: "Wie veröffentliche ich einen Blog in WordPress?",
        body: `Voraussetzung: WordPress muss unter „Einstellungen → Integrationen" verbunden sein. Wenn eine Blog-Variante freigegeben ist, erscheint unten auf der Karte „Nach WordPress senden". Du wählst zwischen „Entwurf" (Draft in WP), „Geplant" (zu Datum X live) oder „Sofort live". Titel, Bild, Tags und Kategorien werden automatisch übernommen.`,
      },
      {
        heading: "Wie erstelle ich ein Beitragsbild?",
        body: `Auf dem Blog-Tab eines Projekts oben auf „Bild erzeugen" klicken und einen Prompt eingeben — die KI erstellt ein Foto und legt automatisch das KnowOn-Logo plus Farbverlauf drüber. Alternativ eigenes Bild hochladen (PNG/JPG/WebP bis 8 MB), es bekommt den Overlay ebenfalls.`,
      },
      {
        heading: "Warum dauert die Bildgenerierung so lange?",
        body: `Die KI-Bilder laufen auf höchster Qualität und brauchen 30–60 Sekunden. Danach noch ein paar Sekunden fürs Logo- und Farbverlauf-Overlay. Einfach warten — das Ergebnis ist eine echte Foto-Qualität wert.`,
      },
      {
        heading: "Wie wechsle ich das Beitragsbild?",
        body: `Wenn mehrere Bilder im Projekt sind: beim gewünschten Bild auf das Stern-Symbol klicken. Das markiert es als Beitragsbild — beim WordPress-Publish wird dieses Bild mitgesendet.`,
      },
    ],
  },
  {
    id: "library",
    icon: BookOpen,
    title: "Bibliothek & Wissen",
    summary: "Inspiration und Fakten für die KI hinterlegen.",
    steps: [
      {
        heading: "Was ist die Inspirations-Bibliothek?",
        body: `Sidebar → „Inspiration". Hier liegen alte KnowOn-Posts, die der KI als Stil-Vorbild dienen. Vor jeder Generierung sucht das System automatisch passende Beispiele raus — je mehr gute Posts hier liegen, desto besser trifft die KI den Ton.`,
      },
      {
        heading: "Wie füge ich Inspirationsquellen hinzu?",
        body: `In der Bibliothek oben auf „Quellen hinzufügen". Drei Wege: „Sync" (automatisch von verbundenen Seiten wie WordPress), „URL-Import" (eine LinkedIn- oder Blog-URL einfügen) oder „Manuell" (eigenen Text eintragen). Posts, die du als besonders stark findest, mit dem Stern als „Favorit" markieren — die KI nimmt sie dann bevorzugt.`,
      },
      {
        heading: "Was sind die Wissens-Dokumente?",
        body: `Sidebar → „Wissen". Hier lädst du PDFs oder Texte hoch, die Fakten enthalten — Produktinfos, Studien, interne Briefings. Die KI kriegt diese Dokumente bei jeder Generierung als Hintergrund mit und kann korrekte Details einbauen.`,
      },
      {
        heading: "Was ist der Unterschied zwischen Inspiration und Wissen?",
        body: `Inspiration = „So klingen wir" (Stil). Wissen = „Das sind die Fakten" (Inhalt). Beides zusammen macht die Texte echt gut: richtiger Ton + richtige Informationen.`,
      },
    ],
  },
  {
    id: "brand",
    icon: Mic,
    title: "Brand Voice",
    summary: "Der Ton, den die KI bei jeder Generierung trifft.",
    steps: [
      {
        heading: "Was ist Brand Voice?",
        body: `Die Anleitung, wie wir klingen. Unter „Einstellungen → Brand Voice" trägst du ein, welchen Ton wir haben, was wir nicht sagen, wen wir ansprechen. Diese Anleitung geht bei JEDER Generierung mit an die KI.`,
      },
      {
        heading: "Wie passe ich den Ton an?",
        body: `Im Reiter „Allgemein" das Feld „Tonfall-Beispiele" ausfüllen: 3–8 perfekte Beispielsätze, die genau wie KnowOn klingen. Das ist der stärkste Hebel. Zusätzlich Do's (was soll drin sein) und Don'ts (was vermeiden) als Stichpunkte listen.`,
      },
      {
        heading: "Kann ich pro Kanal einen anderen Ton festlegen?",
        body: `Ja. Neben „Allgemein" gibt es Tabs für jeden Kanal — dort kannst du Länge, CTA-Stil, kanal-spezifische Do's ergänzen. Leere Felder nutzen einfach den allgemeinen Wert.`,
      },
      {
        heading: "Wie lade ich ein Brand-Logo hoch?",
        body: `Unter „Brand Voice" findest du das Logo-Feld. PNG mit Transparenz ist ideal. Das Logo erscheint in jedem generierten Beitragsbild unten rechts — automatisch, ohne dass du was anklicken musst.`,
      },
    ],
  },
  {
    id: "ai",
    icon: Brain,
    title: "Wie lernt die KI unseren Stil?",
    summary: "Warum die Ergebnisse mit der Zeit besser werden.",
    steps: [
      {
        heading: "Wird die KI wirklich trainiert?",
        body: `Nein — nicht so, wie man es sich vorstellt. Die KI bleibt die gleiche (GPT). Was sich ändert: bei jeder Generierung bekommt sie frisch einen „Beipackzettel" mit — Brand Voice, ausgewählte alte Posts als Beispiele, Fakten aus den Wissens-Dokumenten. Je besser dieser Beipackzettel, desto besser das Ergebnis.`,
      },
      {
        heading: "Warum werden die Texte mit der Zeit besser?",
        body: `Jedes Mal wenn du etwas freigibst, wandert dieser Text automatisch in die Inspirations-Bibliothek als „Favorit". Die nächste Generierung hat also noch mehr deiner echten, gewollten Texte als Vorbild. Das System wächst mit deiner redaktionellen Arbeit.`,
      },
      {
        heading: "Warum kommt jedes Mal ein anderer Text raus?",
        body: `Die KI läuft mit einer leichten Zufallskomponente — das ist Absicht, damit nicht jeder Text gleich klingt. Wenn dir ein Ergebnis nicht passt: einfach „Neu generieren" klicken. Oft reicht ein zweiter Versuch.`,
      },
      {
        heading: "Wie mache ich die Ergebnisse besser?",
        body: `Drei einfache Hebel: (1) Tonfall-Beispiele in der Brand Voice pflegen. (2) Die besten alten Posts in der Bibliothek als Favorit markieren. (3) Konsequent freigeben — jede Freigabe füttert das System weiter.`,
      },
    ],
  },
  {
    id: "team",
    icon: SettingsIcon,
    title: "Team & Einstellungen",
    summary: "Nutzer, WordPress, SMTP — nur für Admins sichtbar.",
    steps: [
      {
        heading: "Wie lege ich einen neuen Nutzer an?",
        body: `„Einstellungen → Team", dann „Nutzer anlegen". Name, E-Mail und ein Passwort eingeben (der „Generieren"-Button erzeugt ein starkes Passwort). Rolle wählen: Admin (alles), Editor (Inhalte erzeugen + bearbeiten), Reviewer (nur prüfen und freigeben).`,
      },
      {
        heading: "Wie verbinde ich WordPress?",
        body: `„Einstellungen → Integrationen" → Abschnitt WordPress. Base-URL (z.B. https://www.knowon.de) + Benutzername + Application-Passwort eintragen. Das ist NICHT dein normales WP-Passwort — es wird separat in WordPress erzeugt unter „Profil → Application Passwords". „Testen"-Häkchen setzen und speichern.`,
      },
      {
        heading: "Wie konfiguriere ich E-Mail-Versand (SMTP)?",
        body: `„Einstellungen → Integrationen" → Abschnitt „E-Mail / SMTP". Host, Port, Benutzer, Passwort eintragen. Wird aktuell nur gespeichert — der tatsächliche Mail-Versand bei Zuweisungen kommt in einer späteren Version dazu.`,
      },
      {
        heading: `Warum sehe ich „Einstellungen" nicht?`,
        body: `Weil du Editor oder Reviewer bist, nicht Admin. Frag einen Admin, dich hochzustufen, wenn du Brand Voice oder Team pflegen willst.`,
      },
    ],
  },
  {
    id: "privacy",
    icon: ShieldCheck,
    title: "Daten & Sicherheit",
    summary: "Wo deine Daten liegen und was an externe Dienste geht.",
    steps: [
      {
        heading: "Wo liegen meine Daten?",
        body: `Alles — Projekte, Texte, Bilder, Notizen, Nutzer — liegt bei Supabase in der EU. Die App selbst läuft auf Vercel. Beides sind professionelle Anbieter mit DSGVO-konformem Betrieb.`,
      },
      {
        heading: "Was wird an OpenAI geschickt?",
        body: `Bei jeder Generierung: dein Thema, dein Briefing, die Brand Voice, die ausgewählten alten Posts als Stil-Beispiele, aktive Wissens-Dokumente. KEINE Passwörter, keine Zugangsdaten, keine Daten anderer Kunden.`,
      },
      {
        heading: "Werden meine Texte zum Trainieren der KI verwendet?",
        body: `Nein. Die OpenAI-Schnittstelle, die wir hier nutzen, trainiert nicht mit den Daten. Das ist anders als bei ChatGPT direkt. Deine Briefings und Texte bleiben bei uns.`,
      },
      {
        heading: "Wer im Team sieht welche Inhalte?",
        body: `Alle Team-Mitglieder sehen alle Projekte — das System ist auf Zusammenarbeit ausgelegt. Unterschiede nur bei Aktionen: Reviewer können nicht selbst erzeugen oder direkt veröffentlichen, Editoren können alles außer Team-Verwaltung, Admins können alles.`,
      },
    ],
  },
  {
    id: "faq",
    icon: MessagesSquare,
    title: "Noch mehr Fragen",
    summary: "Was User sonst noch oft fragen.",
    steps: [
      {
        heading: "Was kostet eine Generierung?",
        body: `Ein kompletter Durchlauf für alle Kanäle: ca. 1–4 Cent. Ein Blog-Beitragsbild: 15–25 Cent. Für etwa 20 Projekte pro Monat insgesamt üblicherweise unter 5 €.`,
      },
      {
        heading: "Kann ich die App auch ohne KI nutzen?",
        body: `Teilweise — Texte kannst du manuell eingeben, indem du ein „leeres" Projekt erstellst und die Inhalte selbst tippst. Den vollen Komfort hast du aber mit der KI-Generierung.`,
      },
      {
        heading: "Was passiert, wenn ich etwas lösche?",
        body: `Ein gelöschtes Projekt ist weg samt allen Kanal-Varianten und Notizen. Bereits freigegebene Texte, die als Favorit in der Inspirations-Bibliothek gelandet sind, bleiben dort — die müsstest du separat löschen.`,
      },
      {
        heading: "Können zwei Leute gleichzeitig am selben Projekt arbeiten?",
        body: `Ja, aber wer zuletzt speichert, überschreibt. Nutze die Notizen auf jeder Kanal-Karte, um euch abzusprechen („Ich nehme LinkedIn, schau du auf Instagram").`,
      },
      {
        heading: "Kann ich einen einzelnen Kanal deaktivieren?",
        body: `Nicht global, aber pro Projekt: auf der „Erzeugen"-Seite einfach nicht ankreuzen. Oder auf der Projekt-Seite eine Kanal-Variante löschen, wenn du sie nicht brauchst.`,
      },
      {
        heading: "Wie bekomme ich einen Kanal zurück, den ich gelöscht habe?",
        body: `Auf der Projekt-Seite auf „Kanäle hinzufügen" klicken. Die KI generiert den fehlenden Kanal aus dem bestehenden Thema + Briefing nach.`,
      },
    ],
  },
];
