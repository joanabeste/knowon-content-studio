import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { HelpPanel } from "@/components/help-panel";
import { ToastProvider } from "@/components/ui/toast";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireUser();

  return (
    <ToastProvider>
      <HelpPanel />
      <div className="flex min-h-screen">
        <Sidebar
          role={profile.role}
          fullName={profile.full_name}
          email={user.email ?? null}
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
