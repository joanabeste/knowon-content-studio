/**
 * Skeleton for the AI-generation preview page. Shown briefly during
 * navigation from the form to the preview screen — the preview page
 * itself is always dynamic (force-dynamic) and re-reads the fresh
 * draft project, so this only smooths the first paint.
 */
export default function PreviewLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-8 w-72 max-w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-muted/70" />
        <div className="h-3 w-48 animate-pulse rounded bg-muted/70" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-56 animate-pulse rounded bg-muted" />
          <div className="h-3 w-80 max-w-full animate-pulse rounded bg-muted/70" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-40 animate-pulse rounded-md bg-muted/70" />
        <div className="h-10 w-28 animate-pulse rounded-md bg-muted/70" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-lg border bg-card p-4"
          >
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted/70" />
            <div className="h-32 w-full animate-pulse rounded bg-muted/50" />
          </div>
        ))}
      </div>
    </div>
  );
}
