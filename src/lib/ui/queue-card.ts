import type { QueueTodaySection } from "@/lib/ops/operational-work";
import { stripReasonCtaEcho } from "@/lib/ui/staff-copy";

export type QueueCardAccent =
  | "urgent"
  | "review"
  | "waiting"
  | "ready"
  | "new"
  | "due";

export function queueCardAccent(
  section: QueueTodaySection | string | null | undefined,
): QueueCardAccent {
  if (section === "urgent") return "urgent";
  if (section === "needs_review") return "review";
  if (section === "waiting") return "waiting";
  if (section === "new") return "new";
  if (section === "due_today") return "due";
  if (section === "ready") return "ready";
  return "due";
}

export const QUEUE_ACCENT_EDGE: Record<QueueCardAccent, string> = {
  urgent: "border-l-danger",
  review: "border-l-pillar-teal",
  waiting: "border-l-warning",
  ready: "border-l-success",
  new: "border-l-pillar-navy",
  due: "border-l-info",
};

export const QUEUE_SECTION_TINT: Record<QueueCardAccent, string> = {
  urgent: "bg-danger-soft text-danger",
  review: "bg-pillar-teal-soft text-pillar-teal",
  waiting: "bg-warning-soft text-warning",
  ready: "bg-success-soft text-success",
  new: "bg-info-soft text-info",
  due: "bg-info-soft text-info",
};

export const QUEUE_SECTION_WASH: Record<QueueCardAccent, string> = {
  urgent: "bg-danger-soft/70",
  review: "bg-pillar-teal-soft/80",
  waiting: "bg-warning-soft/70",
  ready: "bg-success-soft/70",
  new: "bg-info-soft/70",
  due: "bg-info-soft/70",
};

export function queueContextLine(input: {
  loanType?: string | null;
  location?: string | null;
}): string | null {
  const parts = [input.loanType?.trim(), input.location?.trim()].filter(
    (part) => part && part !== "—",
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function queueCardBody(input: {
  title: string;
  reason: string;
  loanType?: string | null;
  queueSection?: string | null;
  assigned: boolean;
  actionLabel?: string;
}): { workItem: string; reason: string | null } {
  const title = input.title.trim();
  const loan = input.loanType?.trim() ?? "";
  const reason = stripReasonCtaEcho(input.reason, input.actionLabel).trim();
  const titleIsLoan = Boolean(loan) && title.toLowerCase() === loan.toLowerCase();

  if (input.queueSection === "new") {
    return {
      workItem: input.assigned ? "New file" : "New unassigned file",
      reason: null,
    };
  }

  if (titleIsLoan) {
    return { workItem: reason || title, reason: null };
  }

  if (!reason || reason.toLowerCase() === title.toLowerCase()) {
    return { workItem: title, reason: null };
  }

  return { workItem: title, reason };
}

export function queueWorkCardLabel(input: {
  borrowerName: string;
  title: string;
  reason: string;
  actionLabel: string;
  ownerName?: string | null;
}): string {
  const owner = input.ownerName?.trim() || "Unassigned";
  return [input.borrowerName, input.title, input.reason, owner, input.actionLabel]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(". ");
}
