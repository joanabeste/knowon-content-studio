"use client";

import { useTransition } from "react";
import { Linkedin, Loader2, RefreshCw, LinkIcon, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  disconnectLinkedinAction,
  syncLinkedinPosts,
} from "./linkedin-actions";

export function LinkedinCard({
  configured,
  connected,
  externalName,
  expiresAt,
}: {
  configured: boolean;
  connected: boolean;
  externalName: string | null;
  expiresAt: string | null;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  const onSync = () => {
    start(async () => {
      const res = await syncLinkedinPosts();
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
      } else if ("fetched" in res) {
        toast.show(
          `${res.imported} neue Beispiele (${res.fetched} Posts abgefragt).`,
          "success",
        );
      }
    });
  };

  const onDisconnect = () => {
    if (!confirm("LinkedIn-Verbindung wirklich trennen?")) return;
    start(async () => {
      await disconnectLinkedinAction();
      toast.show("LinkedIn getrennt.", "success");
    });
  };

  if (!configured) {
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          <strong>LinkedIn ist noch nicht konfiguriert.</strong>
        </p>
        <ol className="ml-4 list-decimal space-y-1 text-xs">
          <li>
            Gehe zu{" "}
            <a
              href="https://www.linkedin.com/developers/apps"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              LinkedIn Developer Apps
            </a>{" "}
            und lege eine neue App an.
          </li>
          <li>
            Unter „Auth" → „Redirect URLs" diese eintragen:
            <div className="mt-1 rounded bg-muted p-2 font-mono text-[10px]">
              {process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}
              /api/oauth/linkedin/callback
            </div>
          </li>
          <li>
            Unter „Products" die Produkte <em>Sign In with LinkedIn</em> und{" "}
            <em>Share on LinkedIn</em> aktivieren (keine Review nötig).
          </li>
          <li>
            App-Credentials in <code>.env.local</code> eintragen:
            <div className="mt-1 rounded bg-muted p-2 font-mono text-[10px]">
              LINKEDIN_CLIENT_ID=...
              <br />
              LINKEDIN_CLIENT_SECRET=...
            </div>
          </li>
          <li>Dev-Server neu starten.</li>
        </ol>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          LinkedIn ist konfiguriert, aber noch nicht verbunden. Verbinde dich
          mit deinem persönlichen LinkedIn-Account — dann kann die App deine
          eigenen Posts als Beispiele ziehen.
        </p>
        <a
          href="/api/oauth/linkedin/start"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <LinkIcon className="h-4 w-4" />
          Mit LinkedIn verbinden
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="default">
          <Linkedin className="mr-1 h-3 w-3" /> Verbunden
        </Badge>
        {externalName && (
          <span className="text-sm font-medium">{externalName}</span>
        )}
        {expiresAt && (
          <span className="text-xs text-muted-foreground">
            Token gültig bis {new Date(expiresAt).toLocaleDateString("de-DE")}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onSync} disabled={pending} size="sm">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Posts synchronisieren
        </Button>
        <Button
          onClick={onDisconnect}
          disabled={pending}
          variant="outline"
          size="sm"
        >
          <Unplug className="h-4 w-4" />
          Trennen
        </Button>
      </div>
    </div>
  );
}
