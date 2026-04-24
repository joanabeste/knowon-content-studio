"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Ins Browser-Log dumpen, damit sowohl Nutzer als auch Vercel-
    // Logs den kompletten Stack sehen können — im Minified-Build
    // ist der Fehlertext sonst kaum hilfreich.
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="de">
      <body>
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md space-y-4 text-center">
            <div>
              <h1 className="text-2xl font-bold">Etwas ist schiefgelaufen</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {error.message || "Unbekannter Fehler"}
              </p>
            </div>
            {error.digest && (
              <div className="rounded-md border bg-muted/30 p-3 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Fehler-ID (an Support geben)
                </p>
                <code className="mt-1 block break-all font-mono text-xs">
                  {error.digest}
                </code>
              </div>
            )}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={reset}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              >
                Erneut versuchen
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-md border px-4 py-2 text-sm"
              >
                Seite neu laden
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
