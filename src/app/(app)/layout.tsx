import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/ui/toast";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, supabase } = await requireUser();

  // Lightweight pending-counts for sidebar badges. Two small aggregate
  // queries; cheap enough to run on every app page load. The queries
  // are defensive against missing tables (early dev environments) by
  // ignoring errors — the sidebar simply hides the badge when the
  // count is 0 or null.
  const [ideasCountRes, reviewCountRes] = await Promise.all([
    supabase
      .from("project_ideas")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
      .is("converted_to_project_id", null),
    supabase
      .from("content_variants")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_review"),
  ]);

  const ideasOpen = ideasCountRes.count ?? 0;
  const reviewOpen = reviewCountRes.count ?? 0;

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar
          role={profile.role}
          fullName={profile.full_name}
          email={user.email ?? null}
          ideasOpen={ideasOpen}
          reviewOpen={reviewOpen}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden bg-muted/30 pt-14 md:pt-0">
          {/*
            pt-14 reserves space for the fixed mobile topbar (h-14).
            md:pt-0 removes it on desktop where the topbar is hidden
            and the sidebar sits in the flex row instead.
            Padding is also tighter on mobile so forms and cards get
            more breathing room on a 375px viewport.
          */}
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
