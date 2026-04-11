#!/usr/bin/env node
/**
 * Seed a local admin user.
 *
 * Usage:
 *   npm run seed:admin
 *
 * Env overrides:
 *   ADMIN_EMAIL      (default: admin@knowon.local)
 *   ADMIN_PASSWORD   (default: admin)
 *   ADMIN_FULL_NAME  (default: Admin)
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local
 * (auto-loaded via `node --env-file=.env.local`).
 */
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@knowon.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME || "Admin";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen.\n" +
      "   Stelle sicher, dass .env.local befüllt ist.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function fail(label, err) {
  console.error(`❌ ${label}: ${err?.message || err}`);
  if (err?.message && /password/i.test(err.message)) {
    console.error(
      "\n💡 Supabase erzwingt per Default mind. 6 Zeichen fürs Passwort.\n" +
        "   Zwei Auswege:\n" +
        "   (a) Supabase-Dashboard → Authentication → Policies → 'Minimum password length'\n" +
        "       auf 5 runtersetzen, dann erneut ausführen.\n" +
        "   (b) Ein längeres Passwort verwenden, z.B.:\n" +
        "       ADMIN_PASSWORD=admin123 npm run seed:admin",
    );
  }
  process.exit(1);
}

async function main() {
  console.log(`Suche existierende User für ${ADMIN_EMAIL}…`);
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) fail("listUsers fehlgeschlagen", listErr);

  let userId;
  const existing = list.users.find(
    (u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
  );

  if (existing) {
    console.log(`✔ User existiert bereits, aktualisiere Passwort…`);
    userId = existing.id;
    const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (updErr) fail("Passwort-Update fehlgeschlagen", updErr);
  } else {
    console.log(`Lege neuen User an…`);
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_FULL_NAME, role: "admin" },
    });
    if (error) fail("createUser fehlgeschlagen", error);
    userId = data.user.id;
  }

  // Ensure profiles row exists with admin role
  console.log(`Setze Profil auf role=admin…`);
  const { error: profErr } = await supabase
    .from("profiles")
    .upsert(
      { id: userId, full_name: ADMIN_FULL_NAME, role: "admin" },
      { onConflict: "id" },
    );
  if (profErr) fail("Profil-Update fehlgeschlagen", profErr);

  console.log("\n✅ Admin-User bereit!");
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Passwort: ${ADMIN_PASSWORD}`);
  console.log(`\n   Login:    http://localhost:3000/login`);
}

main().catch((err) => fail("Unbekannter Fehler", err));
