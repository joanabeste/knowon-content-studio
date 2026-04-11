"use client";

import * as React from "react";
import { Loader2, Upload, Trash2, ImageIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  getBrandLogoSignedUrl,
  removeBrandLogo,
  saveBrandVoice,
  uploadBrandLogo,
} from "./actions";
import type { BrandVoice } from "@/lib/supabase/types";

export function BrandVoiceForm({ initial }: { initial: BrandVoice | null }) {
  const [pending, start] = React.useTransition();
  const [logoPending, startLogo] = React.useTransition();
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [hasLogo, setHasLogo] = React.useState(!!initial?.logo_path);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Lazy-load the signed URL for the current logo (if any)
  React.useEffect(() => {
    if (!hasLogo) {
      setLogoUrl(null);
      return;
    }
    let cancelled = false;
    getBrandLogoSignedUrl().then((res) => {
      if (!cancelled) setLogoUrl(res.url);
    });
    return () => {
      cancelled = true;
    };
  }, [hasLogo]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveBrandVoice(form);
      if ("error" in res && res.error) toast.show(res.error, "error");
      else toast.show("Gespeichert.", "success");
    });
  };

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    startLogo(async () => {
      const res = await uploadBrandLogo(form);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("Logo hochgeladen.", "success");
      setHasLogo(true);
      // force re-fetch of signed url
      const signed = await getBrandLogoSignedUrl();
      setLogoUrl(signed.url);
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  const onLogoRemove = () => {
    if (!confirm("Logo wirklich entfernen?")) return;
    startLogo(async () => {
      const res = await removeBrandLogo();
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("Logo entfernt.", "success");
      setHasLogo(false);
      setLogoUrl(null);
    });
  };

  return (
    <div className="space-y-6">
      {/* Logo upload — lives above the text form because it's its own
          action (file upload) and doesn't share the save button */}
      <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label className="text-sm font-semibold">Brand-Logo</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Wird unten rechts in jedes generierte oder hochgeladene
              Beitragsbild eingebrannt — 1:1 ohne Umfärbung. PNG mit
              transparentem Hintergrund ist ideal. Max 2 MB.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-md border bg-[conic-gradient(from_0deg,_#f3f4f6_25%,_#ffffff_0_50%,_#f3f4f6_0_75%,_#ffffff_0)] bg-[length:12px_12px]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Brand-Logo"
                className="max-h-full max-w-full object-contain p-2"
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/svg+xml,image/webp,image/jpeg"
              onChange={onLogoChange}
              className="hidden"
              id="brand-logo-upload"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={logoPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {logoPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {hasLogo ? "Logo ersetzen" : "Logo hochladen"}
            </Button>
            {hasLogo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={logoPending}
                onClick={onLogoRemove}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Entfernen
              </Button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="tone">Tonfall</Label>
          <Input
            id="tone"
            name="tone"
            defaultValue={initial?.tone ?? ""}
            placeholder="z.B. freundlich, kompetent, nahbar, inspirierend"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audience">Zielgruppe</Label>
          <Textarea
            id="audience"
            name="audience"
            rows={3}
            defaultValue={initial?.audience ?? ""}
            placeholder="z.B. Augenoptiker*innen, die sich digital weiterbilden wollen…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="about_knowon">Über KnowOn (Kurzbeschreibung)</Label>
          <Textarea
            id="about_knowon"
            name="about_knowon"
            rows={3}
            defaultValue={initial?.about_knowon ?? ""}
            placeholder="KnowOn ist eine Online-Lernplattform für…"
          />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dos">Do&apos;s (ein Eintrag pro Zeile)</Label>
            <Textarea
              id="dos"
              name="dos"
              rows={6}
              defaultValue={initial?.dos?.join("\n") ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="donts">Don&apos;ts (ein Eintrag pro Zeile)</Label>
            <Textarea
              id="donts"
              name="donts"
              rows={6}
              defaultValue={initial?.donts?.join("\n") ?? ""}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Speichern
          </Button>
        </div>
      </form>
    </div>
  );
}
