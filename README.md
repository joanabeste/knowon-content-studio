# KnowOn Content Studio

Interne Webapp, mit der das KnowOn-Marketingteam in einem Workflow Content für
**LinkedIn**, **Instagram**, **Eyefox**, **Newsletter** und den **WordPress-Blog**
erzeugt — auf Basis eines zentralen Briefings, via ChatGPT, in konsistentem
Brand-Voice.

**Stack:** Next.js 15 (App Router, TypeScript) · Supabase (Auth + Postgres + Storage) · OpenAI · Tailwind · Vercel

---

## Status

✅ **Phase 1 (MVP) — fertig:**

- Login & "Passwort setzen" (Invite-Flow)
- Rollen-Auth (`admin`, `editor`, `reviewer`) mit RLS auf DB-Ebene
- Admin-Team-Verwaltung: einladen, Rolle ändern
- Brand Voice (Tonfall, Zielgruppe, Do's/Don'ts)
- Golden Examples Library (Vorzeige-Posts pro Kanal)
- Content-Generierung: 1 Briefing → 5 Kanal-Varianten in strukturiertem JSON (OpenAI)
- Projekt-Detail: Inline-Edit pro Kanal, Copy-Buttons, Zeichenzähler
- Approval-Flow: `draft → in_review → approved → published`
- Review-Queue

🟡 **Phase 2 (nächste Schritte):**

- WordPress-Sync (alte Posts importieren)
- WordPress-Publish: Entwurf anlegen + Featured Image hochladen
- Bildgenerierung mit `gpt-image-1` + Supabase Storage
- "Regenerate pro Kanal" (legt neue Version an)

🟡 **Phase 3:**

- Brevo-Newsletter-Draft-Anlegen
- CSV-Import für Source-Posts
- Audit-Log-Page
- Integrations-Settings-UI (aktuell via `.env`)

---

## Setup

### 1. Supabase-Projekt anlegen

1. Gehe zu https://app.supabase.com → **New project**
2. Region: `eu-central-1` (Frankfurt) empfohlen
3. Setze ein starkes DB-Passwort
4. Warte, bis das Projekt provisioniert ist

### 2. Schema & RLS anwenden

1. Öffne im Supabase-Dashboard **SQL Editor** → **New query**
2. Kopiere den Inhalt von [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql) hinein
3. **Run** → das legt Tabellen, Enums, Policies, Trigger, Storage-Bucket an

### 3. Environment-Variablen setzen

```bash
cp .env.example .env.local
```

Trage die Keys ein:

| Variable | Woher |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` (⚠️ geheim) |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `NEXT_PUBLIC_APP_URL` | Lokal: `http://localhost:3000` — auf Vercel: deine Vercel-URL |
| `INTEGRATIONS_ENCRYPTION_KEY` | `openssl rand -hex 32` (32-Byte-Hex) |

### 4. Ersten Admin-User anlegen

Die App erlaubt kein Self-Signup. Der allererste Admin muss manuell angelegt werden:

**Variante A — Über das Supabase-Dashboard:**
1. **Authentication** → **Users** → **Add user** → **Create new user**
2. E-Mail + Passwort vergeben, "Auto Confirm User" ankreuzen
3. **SQL Editor:**
   ```sql
   update public.profiles set role = 'admin' where id = (
     select id from auth.users where email = 'deine@email.de'
   );
   ```

**Variante B — Einladungs-Mail aus dem Dashboard:**
1. **Authentication** → **Users** → **Invite user**
2. Nach Annahme der Einladung + Passwort setzen: gleiche SQL-Query wie oben ausführen.

### 5. Lokal starten

```bash
npm install
npm run dev
```

Öffne http://localhost:3000 → du landest auf `/login`.

### 6. Typecheck / Build

```bash
npm run typecheck
npm run build
```

---

## Architektur-Überblick

```
src/
├── app/
│   ├── login/                      # Öffentlich
│   ├── set-password/               # Öffentlich (Post-Invite)
│   └── (app)/                      # Auth-geschützt (via middleware)
│       ├── layout.tsx              # Sidebar + requireUser()
│       ├── dashboard/
│       ├── generate/               # Core-Workflow: Briefing → OpenAI → 5 Varianten
│       ├── projects/
│       │   └── [id]/               # Detail mit Inline-Edit + Approval
│       ├── review/                 # Review-Queue
│       ├── library/examples/       # Golden Examples
│       └── settings/
│           ├── brand-voice/
│           ├── team/               # Admin-only: einladen, Rolle
│           └── integrations/
├── components/
│   ├── sidebar.tsx
│   └── ui/                         # Button, Card, Input, Textarea, Label, Badge
├── lib/
│   ├── auth.ts                     # requireUser(), requireRole(), hasRole()
│   ├── utils.ts                    # cn(), formatDate()
│   ├── openai/
│   │   ├── client.ts
│   │   ├── schemas.ts              # Zod + JSON-Schema für strukturierten Output
│   │   └── prompts.ts              # System-Prompt-Builder
│   └── supabase/
│       ├── client.ts               # Browser client
│       ├── server.ts               # Server + Admin client
│       └── types.ts                # Hand-written DB types
├── middleware.ts                   # Auth-Guard + Session-Refresh
└── supabase/
    └── migrations/
        └── 0001_init.sql
```

### Rollen (enforced in DB-Policies UND in Server Actions)

| Rolle | Darf |
| --- | --- |
| **Admin** | Alles |
| **Editor** | Content erzeugen, bearbeiten, zu Review schicken, veröffentlichen |
| **Reviewer** | Varianten in Review freigeben oder ablehnen |

Rolle wird beim Einladen gesetzt; Admin kann sie jederzeit in `/settings/team` ändern.

---

## Deployment auf Vercel

1. Repo zu GitHub pushen
2. Vercel → **Add New Project** → Repo auswählen
3. **Environment Variables**: alle Einträge aus `.env.local` übertragen
4. Deploy
5. `NEXT_PUBLIC_APP_URL` auf die finale Vercel-URL setzen und neu deployen
6. Im Supabase-Dashboard: **Authentication** → **URL Configuration** → die Vercel-URL unter **Site URL** eintragen und zu **Redirect URLs** hinzufügen (`https://deine-app.vercel.app/set-password`)

---

## Troubleshooting

- **"missing_profile" nach Login:** Der Trigger `handle_new_user` ist nicht gefeuert. Prüfe, ob die Migration vollständig lief, oder lege die Profile-Zeile manuell an.
- **OpenAI-Fehler bei Generate:** Prüfe `OPENAI_API_KEY`, stelle sicher, dass dein Account Billing aktiviert hat, und dass das Modell in `OPENAI_TEXT_MODEL` deinem API-Zugriff entspricht.
- **Build-Warnung "multiple lockfiles":** Next.js findet Lockfiles oberhalb des Projekts. `next.config.ts` pinnt bereits `outputFileTracingRoot`.
