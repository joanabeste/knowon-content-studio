"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import type {
  ContentVariantWithPeople,
  VariantStatus,
} from "@/lib/supabase/types";
import { setVariantStatus } from "./actions";

export const STATUS_CONFIG: Record<
  VariantStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Entwurf",
    className: "bg-muted text-muted-foreground",
  },
  in_review: {
    // Warm amber — signals "waiting for attention" without being
    // alarming like the brand pink (which reads as error/destructive).
    label: "In Review",
    className: "bg-amber-500 text-white",
  },
  approved: {
    label: "Freigegeben",
    className: "bg-knowon-teal text-white",
  },
  published: {
    label: "Veröffentlicht",
    className: "bg-knowon-purple text-white",
  },
};

export const STATUS_ORDER: VariantStatus[] = [
  "draft",
  "in_review",
  "approved",
  "published",
];

export function StatusBadge({ status }: { status: VariantStatus }) {
  const { label, className } = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        className,
      )}
    >
      {label}
    </span>
  );
}

/**
 * Editable status pill. Uses a native <select> styled to look like a
 * pill badge. On change, calls setVariantStatus server action.
 */
export function StatusSelect({
  variant,
  onChanged,
}: {
  variant: ContentVariantWithPeople;
  onChanged?: (status: VariantStatus) => void;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as VariantStatus;
    if (next === variant.status) return;
    start(async () => {
      const res = await setVariantStatus(variant.id, next);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show(`Status: ${STATUS_CONFIG[next].label}`, "success");
      onChanged?.(next);
    });
  };

  const { className } = STATUS_CONFIG[variant.status];

  return (
    <select
      value={variant.status}
      onChange={onChange}
      disabled={pending}
      aria-label="Status ändern"
      className={cn(
        "cursor-pointer appearance-none rounded-full border-0 py-0.5 pl-2.5 pr-6 text-xs font-semibold transition-opacity",
        "bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2012%2012%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m3%204.5%203%203%203-3%22%2F%3E%3C%2Fsvg%3E')]",
        "bg-[length:12px_12px] bg-no-repeat bg-[position:right_6px_center]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        pending && "opacity-60",
        className,
      )}
    >
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s} className="bg-background text-foreground">
          {STATUS_CONFIG[s].label}
        </option>
      ))}
    </select>
  );
}
