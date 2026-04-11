"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Upload, Loader2, FileText } from "lucide-react";
import { addDocument } from "./actions";

const MAX_BYTES = 200_000; // match server-side limit

export function AddDocumentForm() {
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const onPickFile = () => fileInputRef.current?.click();

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!(lower.endsWith(".txt") || lower.endsWith(".md"))) {
      toast.show("Nur .txt und .md werden unterstützt.", "error");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.show(
        `Datei zu groß (${Math.round(file.size / 1024)}KB, max ${Math.round(MAX_BYTES / 1024)}KB).`,
        "error",
      );
      return;
    }
    const text = await file.text();
    setContent(text);
    setFileName(file.name);
    if (!title) {
      setTitle(file.name.replace(/\.(txt|md)$/i, ""));
    }
    toast.show(`${file.name} geladen.`, "success");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData();
    form.set("title", title);
    form.set("content", content);
    if (fileName) form.set("file_name", fileName);
    form.set("tags", tags);
    start(async () => {
      const res = await addDocument(form);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
      } else {
        toast.show("Dokument gespeichert.", "success");
        setTitle("");
        setContent("");
        setFileName(null);
        setTags("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Titel*</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="z.B. KnowOn-Produktfeatures 2026"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="content">Inhalt*</Label>
          <div className="flex items-center gap-2">
            {fileName && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                {fileName}
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPickFile}
            >
              <Upload className="h-4 w-4" />
              TXT/MD laden
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={onFileSelected}
            />
          </div>
        </div>
        <Textarea
          id="content"
          rows={10}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          placeholder="Plain Text oder Markdown. Wird GPT als zusätzlicher Kontext mitgegeben."
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          {content.length.toLocaleString("de-DE")} /{" "}
          {MAX_BYTES.toLocaleString("de-DE")} Zeichen
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">Tags (kommagetrennt, optional)</Label>
        <Input
          id="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="z.B. produkte, corporate, preise"
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Dokument speichern
      </Button>
    </form>
  );
}
