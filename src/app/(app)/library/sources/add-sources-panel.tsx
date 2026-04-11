"use client";

import * as React from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AddSourcesPanel({
  wpSyncButton,
  eyefoxSyncButton,
  urlImportForm,
}: {
  wpSyncButton: React.ReactNode;
  eyefoxSyncButton: React.ReactNode;
  urlImportForm: React.ReactNode;
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
          className={cn(
            "h-4 w-4 transition-transform",
            open && "rotate-180",
          )}
        />
      </Button>

      {open && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">WordPress-Sync</CardTitle>
              <CardDescription>
                Holt Blog-Posts von knowon.de.
              </CardDescription>
            </CardHeader>
            <CardContent>{wpSyncButton}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Eyefox-Sync</CardTitle>
              <CardDescription>
                Scraped die Partnerseite (best-effort, fragil).
              </CardDescription>
            </CardHeader>
            <CardContent>{eyefoxSyncButton}</CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">URL-Import</CardTitle>
              <CardDescription>
                Einzelne oder mehrere öffentliche URLs (LinkedIn-Post-Link,
                Instagram-Permalink, Eyefox-Artikel, Blog-URL) importieren.
              </CardDescription>
            </CardHeader>
            <CardContent>{urlImportForm}</CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
