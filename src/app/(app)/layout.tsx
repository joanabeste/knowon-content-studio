import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/ui/toast";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireUser();

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar
          role={profile.role}
          fullName={profile.full_name}
          email={user.email ?? null}
        />
        <main className="flex-1 overflow-x-hidden bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
