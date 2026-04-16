import { z } from "zod";

/**
 * Central, typed access to environment variables.
 *
 * Two separate schemas because Next.js only injects `NEXT_PUBLIC_*`
 * vars into the browser bundle — trying to read `SUPABASE_SERVICE_ROLE_KEY`
 * from a client file is a build-time error. Importing the wrong schema
 * from the wrong runtime will therefore fail loudly instead of silently.
 *
 * We validate lazily (on first access) rather than at import time so a
 * missing-but-unused variable doesn't crash an unrelated route. The
 * first consumer of a given var triggers `.parse()`; if that blows up,
 * the error message tells you exactly which key is missing.
 *
 * For routes that are OK to degrade gracefully (e.g. middleware with
 * a fail-open fallback), check `process.env.X` directly — the guard in
 * middleware/src/middleware.ts is intentional and stays as-is.
 */

// --------------------------------------------------------------------
// Client-safe: available in both server and browser bundles
// --------------------------------------------------------------------

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

type ClientEnv = z.infer<typeof clientSchema>;

let _clientEnv: ClientEnv | null = null;

export function clientEnv(): ClientEnv {
  if (_clientEnv) return _clientEnv;
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid client env: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ")}`,
    );
  }
  _clientEnv = parsed.data;
  return _clientEnv;
}

// --------------------------------------------------------------------
// Server-only: service role key, AI keys, crypto, cron secret
// --------------------------------------------------------------------

const serverSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  // OpenAI
  OPENAI_API_KEY: z.string().min(10),
  OPENAI_TEXT_MODEL: z.string().min(1).default("gpt-4o"),
  OPENAI_IMAGE_MODEL: z.string().min(1).default("gpt-image-1"),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Cron + encryption
  CRON_SECRET: z.string().min(16).optional(),
  INTEGRATIONS_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "must be 64 hex chars (32 bytes)")
    .optional(),

  // WordPress fallback (optional; real creds live in DB integrations)
  WORDPRESS_BASE_URL: z.string().url().optional(),
  WORDPRESS_USERNAME: z.string().optional(),
  WORDPRESS_APP_PASSWORD: z.string().optional(),
});

type ServerEnv = z.infer<typeof serverSchema>;

let _serverEnv: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (_serverEnv) return _serverEnv;
  if (typeof window !== "undefined") {
    throw new Error(
      "serverEnv() called from the browser — this will leak server-only secrets",
    );
  }
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server env: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ")}`,
    );
  }
  _serverEnv = parsed.data;
  return _serverEnv;
}
