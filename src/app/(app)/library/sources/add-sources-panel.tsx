"use client";

import * as React from "react";
import {
  ChevronDown,
  Plus,
  Link as LinkIcon,
  FileText,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Collapsible panel with tabbed sub-views. Only the tab the user
 * picks is rendered, so the page doesn't balloon to 4 stacked
 * forms — far less vertical real estate than the old 4-card grid.
 */
export function AddSourcesPanel({
  wpSyncButton,
  eyefoxSyncButton,
  urlImportForm,
  manualAddForm,
}: {
  wpSyncButton: React.ReactNode;
  eyefoxSyncButton: React.ReactNode;
  urlImportForm: React.ReactNode;
  manualAddForm: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        className="w-full justify-between md:w-auto"
      >
        <span className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Quellen hinzufügen
        </span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </Button>

      {open && (
        <Card className="p-4">
          <Tabs defaultValue="sync">
            <TabsList>
              <TabsTrigger value="sync">
                <RefreshCw className="h-4 w-4" />
                Sync
              </TabsTrigger>
              <TabsTrigger value="url">
                <LinkIcon className="h-4 w-4" />
                URL-Import
              </TabsTrigger>
              <TabsTrigger value="manual">
                <FileText className="h-4 w-4" />
                Manuell
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sync">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="mb-1 text-sm font-semibold">
                    WordPress-Sync
                  </div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Holt Blog-Posts von knowon.de.
                  </p>
                  {wpSyncButton}
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="mb-1 text-sm font-semibold">Eyefox-Sync</div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Scraped die Partnerseite (best-effort, fragil).
                  </p>
                  {eyefoxSyncButton}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="url">
              <p className="mb-3 text-xs text-muted-foreground">
                Eine oder mehrere öffentliche URLs (LinkedIn-Post, Instagram,
                Eyefox-Artikel, Blog) importieren.
              </p>
              {urlImportForm}
            </TabsContent>

            <TabsContent value="manual">
              <p className="mb-3 text-xs text-muted-foreground">
                Post-Text direkt einfügen — für alles, was weder als Feed, Sync
                noch als öffentliche URL zugänglich ist.
              </p>
              {manualAddForm}
            </TabsContent>
          </Tabs>
        </Card>
      )}
    </div>
  );
}
