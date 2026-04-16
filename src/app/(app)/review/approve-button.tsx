"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { fireBrandConfetti } from "@/lib/confetti";
import { approveProject } from "@/app/(app)/projects/[id]/actions";

/**
 * One-click project approval from the review queue. Keeps the
 * current assignee (no reassignment from this screen). On success:
 * brand-colored confetti + toast + refresh so the approved project
 * drops out of the list.
 */
export function ApproveProjectButton({
  projectId,
  currentAssigneeId,
  disabled,
}: {
  projectId: string;
  currentAssigneeId: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const onClick = () => {
    if (!confirm("Alle in-review-Kanäle dieses Projekts freigeben?")) return;
    start(async () => {
      const res = await approveProject(projectId, {
        assigneeId: currentAssigneeId,
      });
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show(`${res.count} Kanal/Kanäle freigegeben.`, "success");
      void fireBrandConfetti();
      router.refresh();
    });
  };

  return (
    <Button
      size="sm"
      onClick={onClick}
      disabled={disabled || pending}
      className="bg-knowon-teal hover:bg-knowon-teal/90"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" />
      )}
      Freigeben
    </Button>
  );
}
