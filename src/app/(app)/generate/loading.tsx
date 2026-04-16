/**
 * Fallback shown while the Generate page's Server Component is
 * rendering. Matches the real page's layout (title → channel picker
 * → topic/briefing fields → submit button) so the transition feels
 * seamless instead of a blank flash.
 *
 * Generation itself runs inside a Server Action from the client
 * component and has its own in-form spinner, so this `loading.tsx`
 * only covers the initial navigation to `/generate`.
 */
export default function GenerateLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-8 w-60 animate-pulse rounded bg-muted" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-muted/70" />
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-28 animate-pulse rounded-full bg-muted"
            />
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        <div className="h-10 w-full animate-pulse rounded bg-muted/70" />
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        <div className="h-32 w-full animate-pulse rounded bg-muted/70" />
      </div>

      <div className="h-11 w-60 animate-pulse rounded-md bg-muted" />
    </div>
  );
}
