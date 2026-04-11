"use client";

import * as React from "react";
import Image from "next/image";
import { ImageIcon, Sparkles, Star, Trash2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import type { ImageRow, UserRole } from "@/lib/supabase/types";
import {
  generateBlogImage,
  setFeaturedImage,
  deleteImage,
  getSignedImageUrl,
} from "./actions";

type ImageSize = "1024x1024" | "1536x1024";

export interface ImageWithUrl extends ImageRow {
  signedUrl: string | null;
}

export function BlogImagePanel({
  projectId,
  blogTitle,
  initialImages,
  role,
}: {
  projectId: string;
  blogTitle: string | null;
  initialImages: ImageWithUrl[];
  role: UserRole;
}) {
  const [images, setImages] = React.useState<ImageWithUrl[]>(initialImages);
  const [prompt, setPrompt] = React.useState(
    blogTitle
      ? `Titelbild passend zu "${blogTitle}"`
      : "",
  );
  const [size, setSize] = React.useState<ImageSize>("1536x1024");
  const [pending, setPending] = React.useState(false);
  const [showPromptEditor, setShowPromptEditor] = React.useState(
    initialImages.length === 0,
  );
  const toast = useToast();

  const canEdit = role === "admin" || role === "editor";

  const onGenerate = async () => {
    if (!prompt.trim()) {
      toast.show("Bitte einen Prompt eingeben.", "error");
      return;
    }
    setPending(true);
    try {
      const res = await generateBlogImage(projectId, prompt, size);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      if (res.imageId && res.signedUrl) {
        // If this is the first image for the project, mark it as featured
        // automatically so the user doesn't have to click the star before
        // publishing.
        const isFirst = images.length === 0;
        if (isFirst) {
          await setFeaturedImage(projectId, res.imageId);
        }
        setImages((prev) => [
          {
            id: res.imageId!,
            project_id: projectId,
            prompt,
            storage_path: "",
            wp_media_id: null,
            is_featured: isFirst,
            size,
            created_by: null,
            created_at: new Date().toISOString(),
            signedUrl: res.signedUrl!,
          },
          ...prev,
        ]);
        setShowPromptEditor(false);
        toast.show(
          isFirst
            ? "Bild erzeugt und als Featured markiert."
            : "Bild erzeugt.",
          "success",
        );
      }
    } finally {
      setPending(false);
    }
  };

  const onFeature = async (imageId: string) => {
    const res = await setFeaturedImage(projectId, imageId);
    if ("error" in res && res.error) {
      toast.show(res.error, "error");
      return;
    }
    setImages((prev) =>
      prev.map((img) => ({ ...img, is_featured: img.id === imageId })),
    );
    toast.show("Als Featured Image markiert.", "success");
  };

  const onDelete = async (imageId: string) => {
    if (!confirm("Bild wirklich löschen?")) return;
    const res = await deleteImage(imageId);
    if ("error" in res && res.error) {
      toast.show(res.error, "error");
      return;
    }
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    toast.show("Bild gelöscht.", "success");
  };

  const onRefreshUrl = async (img: ImageWithUrl) => {
    if (!img.storage_path) return;
    const url = await getSignedImageUrl(img.storage_path);
    if (url) {
      setImages((prev) => prev.map((i) => (i.id === img.id ? { ...i, signedUrl: url } : i)));
    }
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          Beitragsbild
        </div>
        {canEdit && images.length > 0 && !showPromptEditor && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPromptEditor(true)}
          >
            <Sparkles className="h-4 w-4" /> Weiteres Bild
          </Button>
        )}
      </div>

      {images.length === 0 && !showPromptEditor && canEdit && (
        <Button variant="outline" onClick={() => setShowPromptEditor(true)}>
          <Sparkles className="h-4 w-4" /> Bild für diesen Beitrag erzeugen
        </Button>
      )}

      {showPromptEditor && canEdit && (
        <div className="mb-4 space-y-3 rounded-md border bg-card p-3">
          <div className="space-y-2">
            <Label htmlFor="image-prompt" className="text-xs">
              Bild-Prompt
            </Label>
            <Textarea
              id="image-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Beschreibe das gewünschte Bild..."
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <Label htmlFor="image-size" className="text-xs">
                Format
              </Label>
              <select
                id="image-size"
                value={size}
                onChange={(e) => setSize(e.target.value as ImageSize)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="1536x1024">Landscape (1536×1024)</option>
                <option value="1024x1024">Quadratisch (1024×1024)</option>
              </select>
            </div>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => setShowPromptEditor(false)}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={onGenerate} disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {pending ? "Generiere…" : "Erzeugen"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Bildgenerierung via gpt-image-1. Dauer ~10–30 Sekunden.
          </p>
        </div>
      )}

      {images.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative overflow-hidden rounded-md border bg-background"
            >
              {img.signedUrl ? (
                <div className="relative aspect-[3/2] w-full">
                  <Image
                    src={img.signedUrl}
                    alt={img.prompt}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover"
                    unoptimized
                    onError={() => onRefreshUrl(img)}
                  />
                </div>
              ) : (
                <div className="flex aspect-[3/2] w-full items-center justify-center bg-muted text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
              {img.is_featured && (
                <Badge
                  variant="default"
                  className="absolute left-2 top-2 shadow"
                >
                  <Star className="mr-1 h-3 w-3 fill-current" /> Featured
                </Badge>
              )}
              <div className="flex items-center justify-between gap-2 p-2">
                <div className="truncate text-xs text-muted-foreground" title={img.prompt}>
                  {img.size}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    {!img.is_featured && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onFeature(img.id)}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRefreshUrl(img)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    {role === "admin" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(img.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
