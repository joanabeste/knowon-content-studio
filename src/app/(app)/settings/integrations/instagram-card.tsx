"use client";

import { useTransition } from "react";
import { Instagram, Loader2, RefreshCw, LinkIcon, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  disconnectInstagramAction,
  syncInstagramMedia,
} from "./instagram-actions";

export function InstagramCard({
  configured,
  connected,
  externalName,
}: {
  configured: boolean;
  connected: boolean;
  externalName: string | null;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  const onSync = () => {
    start(async () => {
      const res = await syncInstagramMedia();
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
    if (!confirm("Instagram-Verbindung wirklich trennen?")) return;
    start(async () => {
      await disconnectInstagramAction();
      toast.show("Instagram getrennt.", "success");
    });
  };

  if (!configured) {
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          <strong>Instagram ist noch nicht konfiguriert.</strong>
        </p>
        <ol className="ml-4 list-decimal space-y-1 text-xs">
          <li>
            <a
              href="https://developers.facebook.com/apps/"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              Meta Developer App anlegen
            </a>{" "}
            (Typ „Business").
          </li>
          <li>
            Products hinzufügen: <em>Facebook Login</em>,{" "}
            <em>Instagram Graph API</em>.
          </li>
          <li>
            Unter Facebook Login → Settings → Valid OAuth Redirect URIs:
            <div className="mt-1 rounded bg-muted p-2 font-mono text-[10px]">
              {process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}
              /api/oauth/instagram/callback
            </div>
          </li>
          <li>
            Dein Instagram-Profil muss ein <em>Business Account</em> sein und
            mit einer Facebook-Page verbunden sein.
          </li>
          <li>
            App-Credentials in <code>.env.local</code>:
            <div className="mt-1 rounded bg-muted p-2 font-mono text-[10px]">
              META_CLIENT_ID=...
              <br />
              META_CLIENT_SECRET=...
            </div>
          </li>
          <li>
            Für Production: Meta App-Review durchlaufen (Permissions{" "}
            <code>instagram_basic</code>, <code>pages_show_list</code>).
          </li>
        </ol>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Instagram ist konfiguriert, aber noch nicht verbunden. Logge dich mit
          deinem Facebook-Account ein, der die Instagram-Business-Page verwaltet.
        </p>
        <a
          href="/api/oauth/instagram/start"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <LinkIcon className="h-4 w-4" />
          Mit Instagram verbinden
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="default">
          <Instagram className="mr-1 h-3 w-3" /> Verbunden
        </Badge>
        {externalName && (
          <span className="text-sm font-medium">{externalName}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onSync} disabled={pending} size="sm">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Media synchronisieren
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
