"use client";

import { useTransition } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { syncAllFeeds } from "./actions";

export function SyncAllButton() {
  const [pending, start] = useTransition();
  const toast = useToast();

  const onClick = () => {
    start(async () => {
      const res = await syncAllFeeds();
      const results = res.results;
      const ok = results.filter(
        (r): r is { ok: true; feedName: string; fetched: number; imported: number } =>
          "ok" in r && r.ok === true,
      );
      const errs = results.filter(
        (r): r is { error: string } => "error" in r,
      );
      const totalImported = ok.reduce((acc, r) => acc + r.imported, 0);
      if (errs.length > 0) {
        toast.show(
          `${ok.length} Feeds ok, ${errs.length} Fehler. ${totalImported} neu.`,
          "error",
        );
      } else if (results.length === 0) {
        toast.show("Keine aktiven Feeds.", "info");
      } else {
        toast.show(
          `Alle Feeds synchronisiert. ${totalImported} neue Einträge.`,
          "success",
        );
      }
    });
  };

  return (
    <Button onClick={onClick} disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      Alle syncen
    </Button>
  );
}
