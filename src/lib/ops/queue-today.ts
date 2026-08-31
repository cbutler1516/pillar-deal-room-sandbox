import { formatWaitingAge } from "@/lib/format";
import type { DecoratedAction } from "@/lib/playbooks/decorate";

export const QUEUE_TODAY_SECTIONS = [
  { key: "urgent", label: "Urgent" },
  { key: "due_today", label: "Due today" },
  { key: "waiting", label: "Waiting" },
  { key: "ready_to_review", label: "Ready to review" },
] as const;

export type QueueTodaySection = (typeof QUEUE_TODAY_SECTIONS)[number]["key"];

export function isDueToday(value: string | null | undefined, now = new Date()): boolean {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function queueTodaySection(
  row: DecoratedAction,
  now = new Date(),
): QueueTodaySection {
  if (
    row.escalationDue ||
    row.overdue ||
    row.priority === "urgent" ||
    row.band === "overdue_or_escalation"
  ) {
    return "urgent";
  }
  if (
    row.followUpDue ||
    isDueToday(row.nextFollowUpAt, now) ||
    row.band === "required_now" ||
    row.band === "required_now_blocked" ||
    row.band === "follow_up_due"
  ) {
    return "due_today";
  }
  if (row.status === "waiting") {
    return "waiting";
  }
  return "ready_to_review";
}

export function groupQueueToday(
  rows: DecoratedAction[],
  now = new Date(),
): Record<QueueTodaySection, DecoratedAction[]> {
  const groups: Record<QueueTodaySection, DecoratedAction[]> = {
    urgent: [],
    due_today: [],
    waiting: [],
    ready_to_review: [],
  };
  for (const row of rows) {
    groups[queueTodaySection(row, now)].push(row);
  }
  return groups;
}

export function queueWhyNow(row: DecoratedAction, now = new Date()): string {
  if (row.contactMissing) {
    return "Contact missing";
  }
  if (row.escalationDue) {
    return "Escalation overdue";
  }
  if (row.followUpDue) {
    const hours = row.waitingAgeHours;
    if (hours != null && hours >= 24) {
      const days = Math.floor(hours / 24);
      return `Follow-up overdue by ${days} day${days === 1 ? "" : "s"}`;
    }
    return "Follow-up overdue";
  }
  if (row.lastResponseAt) {
    return "Response received";
  }
  if (row.band === "document_review") {
    return "Ready to review";
  }
  if (row.status === "waiting") {
    return `Waiting ${formatWaitingAge(row.waitingAgeHours)}`;
  }
  if (isDueToday(row.nextFollowUpAt, now)) {
    return "Due today";
  }
  return row.suggestedRequest || row.instructionsSummary || "Needs attention";
}

export function queuePrimaryAction(row: DecoratedAction): {
  label: string;
  href: string;
} {
  const href = `/deals/${row.dealId}?tab=tasks`;
  if (row.contactMissing) {
    return { label: "Contact", href: `/deals/${row.dealId}?tab=people` };
  }
  if (row.followUpDue || row.escalationDue) {
    return { label: "Follow up", href };
  }
  if (row.lastResponseAt || row.band === "document_review") {
    return { label: "Review", href };
  }
  if (row.status === "waiting") {
    return { label: "Review", href };
  }
  return { label: "Contact", href };
}

export function taskPrimaryActionLabel(input: {
  contactMissing: boolean;
  followUpDue: boolean;
  escalationDue: boolean;
  lastResponseAt?: string | null;
  status: string;
}): string {
  if (input.contactMissing) {
    return "Contact";
  }
  if (input.followUpDue || input.escalationDue) {
    return "Follow up";
  }
  if (input.lastResponseAt) {
    return "Review";
  }
  if (input.status === "completed" || input.status === "dismissed") {
    return "Review";
  }
  if (input.status === "waiting") {
    return "Follow up";
  }
  return "Contact";
}
