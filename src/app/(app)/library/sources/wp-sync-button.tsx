"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Loader2, RefreshCw } from "lucide-react";
import { syncWordpressPosts } from "./actions";

export function WpSyncButton() {
  const [baseUrl, setBaseUrl] = useState("https://www.knowon.de");
  const [limit, setLimit] = useState(20);
  const [pending, start] = useTransition();
  const toast = useToast();

  const onSync = () => {
    start(async () => {
      const res = await syncWordpressPosts({ baseUrl, limit });
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
      } else if ("synced" in res) {
        toast.show(
          `${res.synced} Beiträge synchronisiert (${res.examples ?? 0} neue Blog-Beispiele).`,
          "success",
        );
      }
    });
  };

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_120px_auto] md:items-end">
      <div className="space-y-2">
        <Label htmlFor="wp-url">WordPress-URL</Label>
        <Input
          id="wp-url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://www.knowon.de"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="wp-limit">Anzahl</Label>
        <Input
          id="wp-limit"
          type="number"
          min={1}
          max={100}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        />
      </div>
      <Button onClick={onSync} disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Sync
      </Button>
    </div>
  );
}
