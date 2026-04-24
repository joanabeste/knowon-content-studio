"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Copy,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  addVariantImageByUrl,
  deleteImage,
  uploadVariantImage,
} from "./actions";
import type { ImageWithUrl } from "./blog-image-panel";

/**
 * Generic image panel for non-blog variants. Supports:
 *   - file upload (8 MB, PNG/JPG/WebP)
 *   - pasting an external image URL
 *   - thumbnail grid with copy-URL and delete
 *
 * No AI generation, no brand overlay — the blog keeps its own
 * specialized panel for that. This one is meant for LinkedIn/
 * Instagram/Iprendo-News/Newsletter/Eyefox where authors bring
 * their own visuals.
 */
export function VariantImagesPanel({
  variantId,
  images,
  canEdit,
}: {
  variantId: string;
  images: ImageWithUrl[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [open, setOpen] = useState(images.length > 0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onUpload = (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await uploadVariantImage(variantId, fd);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("Bild hochgeladen.", "success");
      router.refresh();
    });
  };

  const submitUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      toast.show("URL ist leer.", "error");
      return;
    }
    start(async () => {
      const res = await addVariantImageByUrl(variantId, urlInput);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("Bild verlinkt.", "success");
      setUrlInput("");
      setShowUrlInput(false);
      router.refresh();
    });
  };

  const onDelete = (imageId: string) => {
    if (!confirm("Bild wirklich löschen?")) return;
    start(async () => {
      const res = await deleteImage(imageId);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show("Bild gelöscht.", "success");
      router.refresh();
    });
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.show("URL kopiert.", "success");
    } catch {
      toast.show("Kopieren fehlgeschlagen.", "error");
    }
  };

  return (
    <div className="rounded-md border bg-muted/10">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:text-foreground"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Bilder
          {images.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-foreground">
              {images.length}
            </span>
          )}
          <ChevronDown
            className={cn(
              "ml-1 h-3.5 w-3.5 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        {canEdit && open && (
          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
              className="hidden"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending}
              className="h-7 text-xs"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Hochladen
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowUrlInput((v) => !v)}
              disabled={pending}
              className="h-7 text-xs"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              URL
            </Button>
          </div>
        )}
      </div>

      {open && (
      <div className="space-y-2 border-t p-3">
      {showUrlInput && canEdit && (
        <form onSubmit={submitUrl} className="flex items-center gap-1.5">
          <Input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://…/bild.jpg"
            disabled={pending}
            className="h-8 text-xs"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={pending} className="h-8">
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </Button>
        </form>
      )}

      {images.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          Keine Bilder. Lade eins hoch oder füge per URL eins ein.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <div
              key={img.id}
              className={cn(
                "group relative overflow-hidden rounded-md border bg-card",
                "aspect-square",
              )}
            >
              {img.signedUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={img.signedUrl}
                  alt={img.prompt ?? ""}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              {img.external_url && (
                <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-foreground/70 px-1 py-0.5 text-[9px] font-medium text-background">
                  <LinkIcon className="h-2.5 w-2.5" /> URL
                </span>
              )}
              {canEdit && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-foreground/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {img.signedUrl && (
                    <button
                      type="button"
                      onClick={() => copyUrl(img.signedUrl!)}
                      title="URL kopieren"
                      className="inline-flex h-6 w-6 items-center justify-center rounded bg-background/80 text-foreground hover:bg-background"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(img.id)}
                    disabled={pending}
                    title="Löschen"
                    className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded bg-background/80 text-destructive hover:bg-background"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
      )}
    </div>
  );
}
