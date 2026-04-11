import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Seite nicht gefunden.</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-primary underline"
        >
          Zurück zum Dashboard
        </Link>
      </div>
    </main>
  );
}
