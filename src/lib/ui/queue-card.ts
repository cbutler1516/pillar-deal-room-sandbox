import type { QueueTodaySection } from "@/lib/ops/operational-work";

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
  urgent: "border-l-danger/70",
  review: "border-l-pillar-teal",
  waiting: "border-l-warning/80",
  ready: "border-l-success",
  new: "border-l-pillar-navy/50",
  due: "border-l-info/70",
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

export function queueWorkCardLabel(input: {
  borrowerName: string;
  title: string;
  reason: string;
  actionLabel: string;
  ownerName?: string | null;
}): string {
  const owner = input.ownerName?.trim() || "Unassigned";
  return `${input.borrowerName}. ${input.title}. ${input.reason}. ${owner}. ${input.actionLabel}`;
}
