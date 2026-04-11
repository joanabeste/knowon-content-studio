"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Loader2, RefreshCw } from "lucide-react";
import { syncEyefoxPartnerPage } from "./actions";

export function EyefoxSyncButton() {
  const [partnerUrl, setPartnerUrl] = useState(
    "https://www.eyefox.com/partner/3695/knowon-gmbh",
  );
  const [pending, start] = useTransition();
  const toast = useToast();

  const onSync = () => {
    start(async () => {
      const res = await syncEyefoxPartnerPage({ partnerUrl });
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
      } else if ("synced" in res) {
        toast.show(
          `${res.synced} Eyefox-Beiträge importiert.`,
          res.synced === 0 ? "info" : "success",
        );
      }
    });
  };

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
      <div className="space-y-2">
        <Label htmlFor="eyefox-url">Partnerseiten-URL</Label>
        <Input
          id="eyefox-url"
          value={partnerUrl}
          onChange={(e) => setPartnerUrl(e.target.value)}
          placeholder="https://www.eyefox.com/partner/3695/knowon-gmbh"
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
