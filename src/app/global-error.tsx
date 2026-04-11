"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body>
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold">Etwas ist schiefgelaufen</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {error.message || "Unbekannter Fehler"}
            </p>
            {error.digest && (
              <p className="mt-1 text-xs text-muted-foreground">
                Fehler-ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Erneut versuchen
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
