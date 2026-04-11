"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Upload, Loader2, FileText, FilePlus2 } from "lucide-react";
import { addDocument, parsePdfFile } from "./actions";

const MAX_TEXT_BYTES = 200_000;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export function AddDocumentForm() {
  const [pending, start] = useTransition();
  const [pdfPending, startPdf] = useTransition();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const textFileInputRef = useRef<HTMLInputElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const onPickTextFile = () => textFileInputRef.current?.click();
  const onPickPdfFile = () => pdfFileInputRef.current?.click();

  const onTextFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!(lower.endsWith(".txt") || lower.endsWith(".md"))) {
      toast.show("Nur .txt und .md werden unterstützt.", "error");
      return;
    }
    if (file.size > MAX_TEXT_BYTES) {
      toast.show(
        `Datei zu groß (${Math.round(file.size / 1024)}KB, max ${Math.round(MAX_TEXT_BYTES / 1024)}KB).`,
        "error",
      );
      return;
    }
    const text = await file.text();
    setContent(text);
    setFileName(file.name);
    if (!title) setTitle(file.name.replace(/\.(txt|md)$/i, ""));
    toast.show(`${file.name} geladen.`, "success");
  };

  const onPdfFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PDF_BYTES) {
      toast.show(
        `PDF zu groß (${Math.round(file.size / 1024 / 1024)}MB, max 10MB).`,
        "error",
      );
      return;
    }

    const form = new FormData();
    form.set("file", file);

    startPdf(async () => {
      const res = await parsePdfFile(form);
      if ("error" in res) {
        toast.show(res.error, "error");
        return;
      }
      setContent(res.content);
      setFileName(file.name);
      if (!title) setTitle(res.title);
      toast.show(
        `${file.name} geladen (${res.content.length.toLocaleString("de-DE")} Zeichen).`,
        "success",
      );
    });
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
        if (textFileInputRef.current) textFileInputRef.current.value = "";
        if (pdfFileInputRef.current) pdfFileInputRef.current.value = "";
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="content">Inhalt*</Label>
          <div className="flex flex-wrap items-center gap-2">
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
              onClick={onPickTextFile}
              disabled={pdfPending}
            >
              <Upload className="h-4 w-4" />
              TXT/MD laden
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPickPdfFile}
              disabled={pdfPending}
            >
              {pdfPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FilePlus2 className="h-4 w-4" />
              )}
              {pdfPending ? "PDF wird gelesen…" : "PDF laden"}
            </Button>
            <input
              ref={textFileInputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={onTextFileSelected}
            />
            <input
              ref={pdfFileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={onPdfFileSelected}
            />
          </div>
        </div>
        <Textarea
          id="content"
          rows={10}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          placeholder="Plain Text, Markdown oder direkt PDF laden. Wird GPT als zusätzlicher Kontext mitgegeben."
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          {content.length.toLocaleString("de-DE")} /{" "}
          {MAX_TEXT_BYTES.toLocaleString("de-DE")} Zeichen · PDFs bis 10 MB
          werden auf dem Server zu Text extrahiert (keine OCR)
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
