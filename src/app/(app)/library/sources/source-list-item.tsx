"use client";

import * as React from "react";
import { ChevronDown, Star, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CHANNEL_LABELS,
  SOURCE_LABELS,
  type SourcePost,
} from "@/lib/supabase/types";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { SourceRowActions } from "./source-row-actions";

export function SourceListItem({
  post,
  canEdit,
  canDelete,
}: {
  post: SourcePost;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div
      className={cn(
        "group rounded-lg border bg-card transition-colors",
        expanded && "shadow-sm",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/30"
      >
        {/* Featured star */}
        <span className="mt-0.5 shrink-0">
          {post.is_featured ? (
            <Star className="h-4 w-4 fill-knowon-pink text-knowon-pink" />
          ) : (
            <Star className="h-4 w-4 text-muted-foreground/30" />
          )}
        </span>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">
              {post.title || post.body.slice(0, 80)}
            </h3>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Badge variant="secondary" className="text-[10px]">
              {CHANNEL_LABELS[post.channel]}
            </Badge>
            <Badge variant="muted" className="text-[10px]">
              {SOURCE_LABELS[post.source]}
            </Badge>
            <span>·</span>
            <span>
              {post.published_at ? formatDate(post.published_at) : "Ohne Datum"}
            </span>
            <span>·</span>
            <span>{post.body.length.toLocaleString("de-DE")} Zeichen</span>
          </div>
        </div>

        {/* Caret */}
        <ChevronDown
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-3">
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
            {post.body}
          </pre>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div>
              {post.url && (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Original öffnen
                </a>
              )}
            </div>
            <div
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <SourceRowActions
                id={post.id}
                isFeatured={post.is_featured}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
