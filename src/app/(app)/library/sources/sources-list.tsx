"use client";

import * as React from "react";
import { Loader2, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import type { SourcePost } from "@/lib/supabase/types";
import { SourceListItem } from "./source-list-item";
import { bulkDeleteSourcePosts, bulkSetFeatured } from "./actions";

export function SourcesList({
  posts,
  canEdit,
  canDelete,
}: {
  posts: SourcePost[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, start] = React.useTransition();
  const toast = useToast();

  // Reset selection when list changes from the server (after revalidate)
  React.useEffect(() => {
    setSelected((prev) => {
      const nextIds = new Set(posts.map((p) => p.id));
      const filtered = new Set<string>();
      for (const id of prev) if (nextIds.has(id)) filtered.add(id);
      return filtered;
    });
  }, [posts]);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(posts.map((p) => p.id)));
  const clear = () => setSelected(new Set());

  const selectedIds = Array.from(selected);
  const allSelected = posts.length > 0 && selected.size === posts.length;
  const someSelected = selected.size > 0 && !allSelected;

  const onBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (
      !confirm(
        `${selectedIds.length} Eintrag${selectedIds.length === 1 ? "" : "ä"}ge wirklich löschen?`,
      )
    )
      return;
    start(async () => {
      const res = await bulkDeleteSourcePosts(selectedIds);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show(
        `${res.deleted ?? 0} Einträge gelöscht.`,
        "success",
      );
      setSelected(new Set());
    });
  };

  const onBulkFeature = (featured: boolean) => {
    if (selectedIds.length === 0) return;
    start(async () => {
      const res = await bulkSetFeatured(selectedIds, featured);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show(
        `${res.updated ?? 0} Einträge ${
          featured ? "als Featured markiert" : "unfeatured"
        }.`,
        "success",
      );
      setSelected(new Set());
    });
  };

  return (
    <div className="space-y-3">
      {/* Bulk action bar — sticky just below the filter bar, only when
          there's a selection OR to enable "select all" quickly */}
      {posts.length > 0 && canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2">
          <Checkbox
            checked={allSelected}
            onChange={(next) => (next ? selectAll() : clear())}
            aria-label={allSelected ? "Alle abwählen" : "Alle auswählen"}
          />
          <span className="text-xs text-muted-foreground">
            {selected.size === 0
              ? `${posts.length} Einträge`
              : `${selected.size} von ${posts.length} ausgewählt`}
          </span>
          {someSelected && (
            <button
              type="button"
              onClick={clear}
              className="ml-1 inline-flex items-center gap-1 rounded px-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Auswahl aufheben
            </button>
          )}
          <div className="flex-1" />
          {selected.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => onBulkFeature(true)}
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Star className="h-3.5 w-3.5" />
                )}
                Als Featured
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => onBulkFeature(false)}
              >
                <Star className="h-3.5 w-3.5 text-muted-foreground" />
                Unfeatured
              </Button>
              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={onBulkDelete}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Löschen
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* List */}
      <div className="space-y-1.5">
        {posts.map((p) => (
          <SourceListItem
            key={p.id}
            post={p}
            canEdit={canEdit}
            canDelete={canDelete}
            selected={selected.has(p.id)}
            onToggleSelect={canEdit ? () => toggleOne(p.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
