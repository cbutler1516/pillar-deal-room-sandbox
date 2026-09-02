import { formatWaitingAge } from "@/lib/format";
import type { DecoratedAction } from "@/lib/playbooks/decorate";
import {
  QUEUE_TODAY_SECTIONS,
  type OperationalWorkItem,
  type QueueTodaySection,
} from "@/lib/ops/operational-work";
import { staffCalendarDate } from "@/lib/format";
import { contactRoleFromText, humanizeWorkAction, humanizeWorkReason } from "@/lib/ui/staff-copy";
import { deriveQueueActionPlan, type QueueActionPlan } from "@/lib/queue-actions/derive";

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
  if (row.escalationDue && row.escalationLevel && row.escalationLevel !== "none") {
    return "Escalation is required";
  }
  if (row.followUpDue || row.escalationDue) {
    const hours = row.waitingAgeHours;
    if (hours != null && hours >= 24) {
      const days = Math.floor(hours / 24);
      return `Follow-up is overdue by ${days} day${days === 1 ? "" : "s"}`;
    }
    return "Follow-up is overdue";
  }
  if (row.lastResponseAt) {
    return "Reply received — review needed";
  }
  if (row.band === "document_review") {
    return "New document ready for review";
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
  if (row.escalationDue && row.escalationLevel && row.escalationLevel !== "none") {
    return { label: "Escalate", href };
  }
  if (row.followUpDue || row.escalationDue) {
    return { label: "Follow up", href };
  }
  if (row.lastResponseAt) {
    return { label: "Review reply", href };
  }
  if (row.band === "document_review") {
    return { label: "Review document", href };
  }
  if (row.status === "waiting" && row.lastContactedAt) {
    return { label: "Review task", href };
  }
  const role = contactRoleFromText(row.sourceType ?? row.title);
  return { label: role ? `Contact ${role}` : "Contact", href };
}

export function taskPrimaryActionLabel(input: {
  contactMissing: boolean;
  followUpDue: boolean;
  escalationDue: boolean;
  lastResponseAt?: string | null;
  status: string;
  lastContactedAt?: string | null;
  sourceType?: string | null;
  title?: string | null;
  escalationLevel?: string | null;
}): string {
  if (input.contactMissing) {
    return "Add contact";
  }
  if (input.escalationDue && input.escalationLevel && input.escalationLevel !== "none") {
    return "Escalate";
  }
  if (input.followUpDue || input.escalationDue) {
    return "Follow up";
  }
  if (input.lastResponseAt) {
    return "Review reply";
  }
  if (input.status === "completed" || input.status === "dismissed") {
    return "Review task";
  }
  if (input.status === "waiting" && input.lastContactedAt) {
    return "Follow up";
  }
  const role = contactRoleFromText(input.sourceType ?? input.title);
  return role ? `Contact ${role}` : "Contact";
}

export function workQueueRow(
  row: OperationalWorkItem,
  extra: { location?: string | null; canMutate?: boolean } = {},
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
  actionPlan: QueueActionPlan;
} {
  return {
    id: row.id,
    dealId: row.dealId,
    borrowerName: row.borrowerName,
    entityName: row.entityName,
    loanType: row.loanType,
    location: extra.location ?? null,
    title: row.title,
    reason: humanizeWorkReason(row.reason),
    actionLabel: humanizeWorkAction(row),
    href: row.href,
    hot: row.priorityBand === "critical" || row.dueState === "overdue",
    assignedProcessorId: row.assignedProcessorId,
    queueSection: row.queueSection,
    dueAt: row.dueAt,
    actionPlan: deriveQueueActionPlan(row, {
      canMutate: extra.canMutate ?? true,
    }),
  };
}
