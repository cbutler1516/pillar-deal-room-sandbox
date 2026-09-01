import { formatWaitingAge } from "@/lib/format";
import type { DecoratedAction } from "@/lib/playbooks/decorate";
import {
  QUEUE_TODAY_SECTIONS,
  type OperationalWorkItem,
  type QueueTodaySection,
} from "@/lib/ops/operational-work";
import { staffCalendarDate } from "@/lib/format";

export { QUEUE_TODAY_SECTIONS };
export type { QueueTodaySection };

export function isDueToday(value: string | null | undefined, now = new Date()): boolean {
  if (!value) {
    return false;
  }
  return staffCalendarDate(new Date(value)) === staffCalendarDate(now);
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
  if (row.status === "waiting" && row.lastContactedAt) {
    return `Waiting ${formatWaitingAge(row.waitingAgeHours)}`;
  }
  if (row.status === "waiting" && !row.lastContactedAt) {
    return "No request has been sent yet";
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
    return { label: "Add contact", href: `/deals/${row.dealId}?tab=people` };
  }
  if (row.followUpDue || row.escalationDue) {
    return { label: "Follow up", href };
  }
  if (row.lastResponseAt || row.band === "document_review") {
    return { label: "Review", href };
  }
  if (row.status === "waiting" && row.lastContactedAt) {
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
  lastContactedAt?: string | null;
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
  if (input.status === "waiting" && input.lastContactedAt) {
    return "Follow up";
  }
  return "Contact";
}

export function workQueueRow(
  row: OperationalWorkItem,
  extra: { location?: string | null } = {},
): {
  id: string;
  dealId: string;
  borrowerName: string;
  entityName: string | null;
  loanType: string | null;
  location: string | null;
  title: string;
  reason: string;
  actionLabel: string;
  href: string;
  hot: boolean;
  assignedProcessorId: string | null;
  queueSection: QueueTodaySection;
  dueAt: string | null;
} {
  return {
    id: row.id,
    dealId: row.dealId,
    borrowerName: row.borrowerName,
    entityName: row.entityName,
    loanType: row.loanType,
    location: extra.location ?? null,
    title: row.title,
    reason: row.reason,
    actionLabel: row.recommendedAction,
    href: row.href,
    hot: row.priorityBand === "critical" || row.dueState === "overdue",
    assignedProcessorId: row.assignedProcessorId,
    queueSection: row.queueSection,
    dueAt: row.dueAt,
  };
}
