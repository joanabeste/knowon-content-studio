"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  FolderOpen,
  FileText,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronUp,
  Lightbulb,
  Users,
  Mic,
  Plug,
  LogOut,
  Menu,
  UserCog,
  X,
  type LucideIcon,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/supabase/types";

type Badge = { count: number; tone: "pink" | "amber" } | null;

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: "ideas" | "review";
};

type NavSection = {
  title?: string; // optional — top section has no label
  items: NavItem[];
  adminOnly?: boolean;
};

/**
 * Nav tree. The top group has no title so the Dashboard sits as a
 * standalone home anchor; "Content" gathers the full workflow from
 * idea to review, then the library and admin groups follow.
 */
const sections: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/ideas", label: "Ideen", icon: Lightbulb, badgeKey: "ideas" },
      { href: "/generate", label: "Erzeugen", icon: Sparkles },
      { href: "/projects", label: "Projekte", icon: FolderOpen },
      { href: "/calendar", label: "Kalender", icon: CalendarDays },
      {
        href: "/review",
        label: "Review",
        icon: CheckCircle2,
        badgeKey: "review",
      },
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

function BadgePill({ badge }: { badge: Badge }) {
  if (!badge || badge.count <= 0) return null;
  const toneClass =
    badge.tone === "pink"
      ? "bg-knowon-pink/15 text-knowon-pink"
      : "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return (
    <span
      className={cn(
        "ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        toneClass,
      )}
      aria-label={`${badge.count} offen`}
    >
      {badge.count}
    </span>
  );
}

/**
 * The actual navigation + footer body. Rendered both inside the
 * desktop `<aside>` and inside the mobile drawer so the two views
 * stay in sync. `onNavigate` lets the mobile drawer auto-close
 * when the user picks a link.
 */
function SidebarContent({
  role,
  fullName,
  email,
  ideasOpen,
  reviewOpen,
  onNavigate,
}: {
  role: UserRole;
  fullName: string | null;
  email: string | null;
  ideasOpen: number;
  reviewOpen: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);

  const logout = () => {
    setAccountMenuOpen(false);
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

  const badgeFor = (key?: "ideas" | "review"): Badge => {
    if (key === "ideas" && ideasOpen > 0)
      return { count: ideasOpen, tone: "pink" };
    if (key === "review" && reviewOpen > 0)
      return { count: reviewOpen, tone: "amber" };
    return null;
  };

  return (
    <>
      {/* Brand — single line, no redundant "MARKETING" subtitle */}
      <div className="border-b px-5 py-4">
        <Link href="/dashboard" className="block" onClick={onNavigate}>
          <div className="text-lg font-bold leading-tight text-knowon-purple">
            KnowOn <span className="text-knowon-teal">Studio</span>
          </div>
        </Link>
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {sections
            .filter((s) => !s.adminOnly || role === "admin")
            .map((section, idx) => (
              <div key={section.title ?? `top-${idx}`}>
                {section.title && (
                  <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {section.title}
                  </div>
                )}
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
                        onClick={onNavigate}
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
                        <span className="flex-1">{item.label}</span>
                        <BadgePill badge={badgeFor(item.badgeKey)} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </nav>

      {/* User footer — single compact row, popover for account+logout */}
      <div className="relative border-t p-3">
        <button
          type="button"
          onClick={() => setAccountMenuOpen((v) => !v)}
          aria-expanded={accountMenuOpen}
          aria-haspopup="menu"
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-2 py-2 transition-colors",
            accountMenuOpen || accountActive
              ? "bg-muted"
              : "hover:bg-muted",
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-knowon-teal/15 text-[11px] font-semibold text-knowon-teal">
            {initials}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div
              className={cn(
                "truncate text-sm font-medium",
                accountActive ? "text-primary" : "text-foreground",
              )}
            >
              {displayName}
            </div>
            <div className="truncate text-[11px] capitalize text-muted-foreground">
              {role}
            </div>
          </div>
          <ChevronUp
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              !accountMenuOpen && "rotate-180",
            )}
          />
        </button>

        {accountMenuOpen && (
          <>
            {/* Click-outside catcher */}
            <button
              type="button"
              aria-label="Menü schließen"
              onClick={() => setAccountMenuOpen(false)}
              className="fixed inset-0 z-30"
            />
            <div
              role="menu"
              className="absolute inset-x-3 bottom-[calc(100%+0.25rem)] z-40 overflow-hidden rounded-md border bg-card p-1 shadow-lg"
            >
              <Link
                href="/settings/account"
                onClick={() => {
                  setAccountMenuOpen(false);
                  onNavigate?.();
                }}
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors",
                  accountActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <UserCog className="h-4 w-4" />
                Account
              </Link>
              <button
                type="button"
                onClick={logout}
                disabled={pending}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                {pending ? "Abmelden…" : "Abmelden"}
              </button>
              <div className="mt-1 truncate border-t px-2 pt-1 text-[10px] text-muted-foreground">
                {email}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function Sidebar({
  role,
  fullName,
  email,
  ideasOpen,
  reviewOpen,
}: {
  role: UserRole;
  fullName: string | null;
  email: string | null;
  ideasOpen: number;
  reviewOpen: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Auto-close the drawer whenever the route changes (navigation
  // typically triggered by a link inside the drawer, but this also
  // catches programmatic nav). Safe no-op on desktop.
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock page scroll while the mobile drawer is open so the
  // background doesn't scroll underneath.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop sidebar — identical layout to before, but now
          explicitly hidden below md so mobile main can take the
          full viewport width. */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card md:flex">
        <SidebarContent
          role={role}
          fullName={fullName}
          email={email}
          ideasOpen={ideasOpen}
          reviewOpen={reviewOpen}
        />
      </aside>

      {/* Mobile top bar — fixed at top of viewport, only shown
          below md. Position: fixed takes it out of the flex flow,
          so it doesn't interfere with the desktop layout. */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Menü öffnen"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="flex-1 truncate">
          <span className="text-base font-bold text-knowon-purple">
            KnowOn <span className="text-knowon-teal">Studio</span>
          </span>
        </Link>
      </header>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Menü schließen"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-foreground/50 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Mobile drawer itself — slides in from the left. Shares
          the same nav content as the desktop aside via
          SidebarContent, so there's no second source of truth. */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r bg-card shadow-xl transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="absolute right-2 top-2">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Menü schließen"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SidebarContent
          role={role}
          fullName={fullName}
          email={email}
          ideasOpen={ideasOpen}
          reviewOpen={reviewOpen}
          onNavigate={() => setMobileOpen(false)}
        />
      </aside>
    </>
  );
}
