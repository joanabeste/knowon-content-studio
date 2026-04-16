"use client";

import * as React from "react";
import { HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { HELP_SECTIONS } from "@/lib/help-content";

/**
 * HelpPanel — a global "how do I use this" resource.
 *
 * Floating help button fixed top-right of the viewport. Clicking it
 * slides a panel in from the right containing accordion-style
 * sections with concrete how-tos for the main workflows.
 *
 * Lives in the app layout so it's reachable from every page without
 * cluttering the sidebar. Content lives right here in code (not in
 * markdown files or a CMS) because it's versioned alongside the
 * features — whoever adds a feature also updates the help entry in
 * the same PR.
 */

// Content lives in src/lib/help-content.ts so it can be edited
// without touching the UI logic. Kept that indirection minimal —
// just an import + local alias so the JSX below stays readable.
const SECTIONS = HELP_SECTIONS;

export function HelpPanel() {
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>("overview");

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock body scroll while open
  React.useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <>
      {/* Floating help button. Fixed top-right of the viewport so
          it's reachable from every page without claiming sidebar
          space. On mobile it sits to the right of the fixed topbar
          (which is h-14, so top-3 puts the button vertically
          centered). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Hilfe & Anleitung öffnen"
        title="Hilfe & Anleitung"
        className={cn(
          "fixed right-4 top-3 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-foreground md:top-4 md:h-10 md:w-10",
        )}
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Hilfe schließen"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-foreground/50 backdrop-blur-sm"
        />
      )}

      {/* Slide-in panel from the right. Uses the same transform
          pattern as the mobile sidebar drawer. */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-card shadow-xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-base font-bold text-foreground">
              Hilfe & Anleitung
            </div>
            <p className="text-xs text-muted-foreground">
              Kurze Leitfäden für den Alltag mit KnowOn Studio
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Schließen"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable sections */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-1.5">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isOpen = expanded === section.id;
              return (
                <div
                  key={section.id}
                  className={cn(
                    "rounded-lg border transition-colors",
                    isOpen
                      ? "border-primary/30 bg-primary/[0.03]"
                      : "border-border bg-background hover:border-muted-foreground/30",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : section.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left"
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                        isOpen
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground">
                        {section.title}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {section.summary}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "mt-1 text-xs text-muted-foreground transition-transform",
                        isOpen && "rotate-90",
                      )}
                      aria-hidden="true"
                    >
                      ▸
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-primary/15 px-4 pb-4 pt-3">
                      <ol className="space-y-3 text-sm text-foreground/90">
                        {section.steps.map((step, i) => {
                          if (typeof step === "string") {
                            return (
                              <li key={i} className="flex gap-3">
                                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                                  {i + 1}
                                </span>
                                <span className="leading-relaxed">
                                  {step}
                                </span>
                              </li>
                            );
                          }
                          return (
                            <li key={i} className="space-y-1">
                              <div className="text-[13px] font-semibold text-foreground">
                                {step.heading}
                              </div>
                              <p className="text-[13px] leading-relaxed text-foreground/80">
                                {step.body}
                              </p>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/30 px-5 py-3 text-[11px] text-muted-foreground">
          Fehlt dir etwas oder willst du einen Leitfaden anpassen? Sprich dein
          Team an — die Inhalte leben im Code und werden beim nächsten
          Feature-Update mitgepflegt.
        </div>
      </aside>
    </>
  );
}
