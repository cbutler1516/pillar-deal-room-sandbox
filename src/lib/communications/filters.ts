import { sequenceStage, type SequenceTask } from "@/lib/communications/sequence";
import { isFollowUpDue } from "@/lib/playbooks/logic";

export const QUEUE_FILTERS = [
  "due_today",
  "overdue",
  "waiting_borrower",
  "waiting_third_party",
  "escalated",
  "no_contact",
  "response_received",
  "ready_review",
] as const;

export type QueueFilter = (typeof QUEUE_FILTERS)[number];

export type QueueFilterTask = SequenceTask & {
  id: string;
  title?: string | null;
  taskKind?: string | null;
  band?: string | null;
  followUpDue?: boolean;
  escalationDue?: boolean;
  lastResponseAt?: string | null;
};

export function parseQueueFilter(value: string | undefined): QueueFilter | null {
  if (!value) {
    return null;
  }
  return (QUEUE_FILTERS as readonly string[]).includes(value)
    ? (value as QueueFilter)
    : null;
}

function isToday(iso: string | null | undefined, now: Date): boolean {
  if (!iso) {
    return false;
  }
  const date = new Date(iso);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function matchesQueueFilter(
  task: QueueFilterTask,
  filter: QueueFilter | null,
  now = new Date(),
): boolean {
  if (!filter) {
    return true;
  }
  const stage = sequenceStage(task, now);
  const followUpDue =
    task.followUpDue ??
    isFollowUpDue(
      {
        status: task.status,
        nextFollowUpAt: task.nextFollowUpAt ?? null,
        lastContactedAt: task.lastContactedAt ?? null,
        followUpIntervalHours: task.followUpIntervalHours ?? null,
      },
      now,
    );
  switch (filter) {
    case "due_today":
      return isToday(task.nextFollowUpAt, now) || followUpDue;
    case "overdue":
      return followUpDue || task.escalationDue === true || stage === "escalation";
    case "waiting_borrower":
      return task.status === "waiting" && task.sourceType === "borrower";
    case "waiting_third_party":
      return (
        task.status === "waiting" &&
        task.sourceType != null &&
        task.sourceType !== "borrower" &&
        task.sourceType !== "internal"
      );
    case "escalated":
      return task.escalationDue === true || stage === "escalation";
    case "no_contact":
      return stage === "no_contact";
    case "response_received":
      return stage === "response_received" || Boolean(task.lastResponseAt);
    case "ready_review":
      return (
        task.taskKind === "review_document" ||
        task.band === "document_review" ||
        Boolean(task.lastResponseAt)
      );
  }
}
