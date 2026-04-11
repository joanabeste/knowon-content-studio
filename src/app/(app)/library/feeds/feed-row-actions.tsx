"use client";

import { useTransition } from "react";
import { RefreshCw, Eye, EyeOff, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteFeed, syncFeed, toggleFeedActive } from "./actions";

export function FeedRowActions({
  feedId,
  feedName,
  isActive,
}: {
  feedId: string;
  feedName: string;
  isActive: boolean;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  const onSync = () => {
    start(async () => {
      const res = await syncFeed(feedId);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
      } else if ("fetched" in res) {
        toast.show(
          `${res.feedName}: ${res.imported} importiert (${res.fetched} abgerufen)`,
          "success",
        );
      }
    });
  };

  const onToggle = () => {
    start(async () => {
      const res = await toggleFeedActive(feedId);
      if ("error" in res && res.error) toast.show(res.error, "error");
    });
  };

  const onDelete = () => {
    if (!confirm(`Feed "${feedName}" löschen?`)) return;
    start(async () => {
      const res = await deleteFeed(feedId);
      if ("error" in res && res.error) toast.show(res.error, "error");
      else toast.show("Feed gelöscht.", "success");
    });
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={onSync}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Sync
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        disabled={pending}
        title={isActive ? "Deaktivieren" : "Aktivieren"}
      >
        {isActive ? (
          <Eye className="h-4 w-4" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={pending}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
