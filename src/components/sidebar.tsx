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
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/supabase/types";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavSection = {
  title: string;
  items: NavItem[];
  adminOnly?: boolean;
};

const sections: NavSection[] = [
  {
    title: "Arbeitsbereich",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/generate", label: "Erzeugen", icon: Sparkles },
      { href: "/projects", label: "Projekte", icon: FolderOpen },
      { href: "/review", label: "Review", icon: CheckCircle2 },
    ],
  },
  {
    title: "Bibliothek",
    items: [
      { href: "/library/sources", label: "Inspiration", icon: BookOpen },
      { href: "/library/documents", label: "Wissen", icon: FileText },
    ],
  },
  {
    title: "Einstellungen",
    adminOnly: true,
    items: [
      { href: "/settings/brand-voice", label: "Brand Voice", icon: Mic },
      { href: "/settings/team", label: "Team", icon: Users },
      { href: "/settings/integrations", label: "Integrationen", icon: Plug },
    ],
  },
];

function getInitials(name: string | null, fallback = "?"): string {
  if (!name || !name.trim()) return fallback;
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || fallback
  );
}

export function Sidebar({
  role,
  fullName,
  email,
}: {
  role: UserRole;
  fullName: string | null;
  email: string | null;
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

  const displayName = fullName || email?.split("@")[0] || "User";
  const initials = getInitials(fullName || email);
  const accountActive =
    pathname === "/settings/account" ||
    pathname.startsWith("/settings/account/");

  return (
    <aside className="flex w-60 flex-col border-r bg-card">
      {/* Brand */}
      <div className="border-b px-5 py-5">
        <Link href="/dashboard" className="block">
          <div className="text-lg font-bold leading-tight text-knowon-purple">
            KnowOn <span className="text-knowon-teal">Studio</span>
          </div>
        </Link>
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <div className="space-y-6">
          {sections
            .filter((s) => !s.adminOnly || role === "admin")
            .map((section) => (
              <div key={section.title}>
                <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section.title}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active =
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                        )}
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active && "text-primary",
                          )}
                          strokeWidth={active ? 2.4 : 2}
                        />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t p-3">
        <Link
          href="/settings/account"
          className={cn(
            "flex items-center gap-3 rounded-md px-2 py-2 transition-colors",
            accountActive
              ? "bg-primary/10"
              : "hover:bg-muted",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-knowon-teal/15 text-sm font-semibold text-knowon-teal">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "truncate text-sm font-medium",
                accountActive ? "text-primary" : "text-foreground",
              )}
            >
              {displayName}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {email || <span className="capitalize">{role}</span>}
            </div>
          </div>
        </Link>
        <button
          onClick={logout}
          disabled={pending}
          className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          {pending ? "Abmelden…" : "Abmelden"}
        </button>
      </div>
    </aside>
  );
}
