"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  LayoutDashboard,
  Sparkles,
  FolderOpen,
  FileText,
  BookOpen,
  CheckCircle2,
  Users,
  Mic,
  Plug,
  UserCircle2,
  LogOut,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/supabase/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const nav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/generate", label: "Content erzeugen", icon: Sparkles },
  { href: "/projects", label: "Projekte", icon: FolderOpen },
  { href: "/review", label: "Review", icon: CheckCircle2 },
  { href: "/library/sources", label: "Inspirations-Bibliothek", icon: BookOpen },
  { href: "/library/documents", label: "Wissens-Dokumente", icon: FileText },
  { href: "/settings/account", label: "Mein Account", icon: UserCircle2 },
  { href: "/settings/brand-voice", label: "Brand Voice", icon: Mic, adminOnly: true },
  { href: "/settings/team", label: "Team", icon: Users, adminOnly: true },
  { href: "/settings/integrations", label: "Integrationen", icon: Plug, adminOnly: true },
];

export function Sidebar({
  role,
  fullName,
}: {
  role: UserRole;
  fullName: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();

  const logout = () => {
    start(async () => {
      const supabase = getSupabaseBrowser();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    });
  };

  return (
    <aside className="flex w-64 flex-col border-r bg-card">
      <div className="border-b p-6">
        <Link href="/dashboard" className="block">
          <div className="text-lg font-bold text-knowon-purple">
            KnowOn <span className="text-knowon-teal">Studio</span>
          </div>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {nav
          .filter((item) => !item.adminOnly || role === "admin")
          .map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
      </nav>
      <div className="border-t p-4">
        <div className="mb-2 px-2 text-xs text-muted-foreground">
          <div className="font-semibold text-foreground">
            {fullName || "User"}
          </div>
          <div className="capitalize">{role}</div>
        </div>
        <button
          onClick={logout}
          disabled={pending}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          {pending ? "Abmelden…" : "Abmelden"}
        </button>
      </div>
    </aside>
  );
}
