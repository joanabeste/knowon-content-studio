import { requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { ContextDocument } from "@/lib/supabase/types";
import { AddDocumentForm } from "./add-document-form";
import { DocumentActions } from "./document-actions";
import { Badge } from "@/components/ui/badge";

export default async function DocumentsPage() {
  const { supabase, profile } = await requireUser();

  const { data } = await supabase
    .from("context_documents")
    .select("*")
    .order("created_at", { ascending: false });

  const docs = (data ?? []) as ContextDocument[];
  const canEdit = profile.role === "admin" || profile.role === "editor";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Wissens-Dokumente</h1>
        <p className="text-muted-foreground">
          Zusätzlicher Kontext, den GPT bei jeder Generierung berücksichtigt.
          Aktive Dokumente fließen in den System-Prompt ein.
        </p>
      </div>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Neues Dokument</CardTitle>
            <CardDescription>
              Text direkt einfügen ODER eine TXT-/MD-Datei hochladen. Der
              Inhalt wird gelesen und gespeichert — GPT sieht nur den Text.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddDocumentForm />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {docs.map((doc) => (
          <Card key={doc.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{doc.title}</CardTitle>
                  {doc.source === "upload" && doc.file_name && (
                    <Badge variant="muted" className="text-[10px]">
                      {doc.file_name}
                    </Badge>
                  )}
                  {!doc.is_active && (
                    <Badge variant="outline">inaktiv</Badge>
                  )}
                </div>
                <DocumentActions doc={doc} canEdit={canEdit} />
              </div>
              <CardDescription>
                Erstellt {formatDate(doc.created_at)} · {doc.content.length.toLocaleString("de-DE")} Zeichen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                {doc.content.slice(0, 800)}
                {doc.content.length > 800 ? "…" : ""}
              </pre>
            </CardContent>
          </Card>
        ))}
        {!docs.length && (
          <p className="text-sm text-muted-foreground">
            Noch keine Dokumente. Füge eins hinzu, damit es in Generierungen
            einfließt.
          </p>
        )}
      </div>
    </div>
  );
}
