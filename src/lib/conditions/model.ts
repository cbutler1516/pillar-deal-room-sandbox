export const CONDITION_TASK_TYPE = "lender_condition";

export const CONDITION_STATUSES = [
  "open",
  "waiting",
  "received",
  "needs_review",
  "cleared",
] as const;

export type ConditionStatus = (typeof CONDITION_STATUSES)[number];

export type ConditionTaskLike = {
  sourceType?: string | null;
  taskType?: string | null;
  playbookKey?: string | null;
  status?: string | null;
};

export type ConditionNeedLike = {
  status?: string | null;
};

export function isLenderCondition(task: ConditionTaskLike): boolean {
  if (task.sourceType === "lender") {
    return true;
  }
  return (
    task.taskType === CONDITION_TASK_TYPE ||
    task.playbookKey === CONDITION_TASK_TYPE
  );
}

export function conditionStatus(
  task: ConditionTaskLike,
  need?: ConditionNeedLike | null,
): ConditionStatus {
  if (task.status === "completed" || task.status === "dismissed") {
    return "cleared";
  }
  const needStatus = need?.status ?? null;
  if (needStatus === "needs_review") {
    return "needs_review";
  }
  if (needStatus === "received") {
    return "received";
  }
  if (task.status === "waiting") {
    return "waiting";
  }
  return "open";
}

export function conditionStatusLabel(status: ConditionStatus): string {
  if (status === "needs_review") {
    return "Needs review";
  }
  if (status === "cleared") {
    return "Cleared";
  }
  if (status === "received") {
    return "Received";
  }
  if (status === "waiting") {
    return "Waiting";
  }
  return "Open";
}

export function conditionQueueReason(workType: string): string {
  if (
    workType === "document_awaiting_review" ||
    workType === "replacement_received" ||
    workType === "response_received"
  ) {
    return "Condition response received";
  }
  if (workType === "document_mismatch" || workType === "document_duplicate") {
    return "Condition document needs review";
  }
  if (
    workType === "follow_up_overdue" ||
    workType === "follow_up_due_today" ||
    workType === "waiting_beyond_cadence" ||
    workType === "no_initial_contact" ||
    workType === "active_collection"
  ) {
    return "Condition still outstanding";
  }
  if (workType === "waiting_on_response") {
    return "Waiting on a condition response";
  }
  return "Condition still outstanding";
}

export function conditionQueueAction(workType: string): string {
  if (
    workType === "document_awaiting_review" ||
    workType === "replacement_received" ||
    workType === "response_received" ||
    workType === "document_mismatch" ||
    workType === "document_duplicate"
  ) {
    return "Review condition";
  }
  if (workType === "waiting_on_response") {
    return "Review condition";
  }
  return "Follow up";
}

export function conditionSummary(input: {
  tasks: Array<ConditionTaskLike & { clientNeedId?: string | null }>;
  needs: Array<{ id: string; status: string }>;
}): { open: number; received: number; waiting: number; review: number; cleared: number } {
  const counts = { open: 0, received: 0, waiting: 0, review: 0, cleared: 0 };
  for (const task of input.tasks) {
    if (!isLenderCondition(task)) {
      continue;
    }
    const need = input.needs.find((row) => row.id === task.clientNeedId);
    const status = conditionStatus(task, need);
    if (status === "needs_review") counts.review += 1;
    else if (status === "received") counts.received += 1;
    else if (status === "waiting") counts.waiting += 1;
    else if (status === "cleared") counts.cleared += 1;
    else counts.open += 1;
  }
  return counts;
}

export function parseConditionSource(instructions: string | null | undefined): string | null {
  const line = (instructions ?? "").split("\n")[0]?.trim() ?? "";
  const match = line.match(/^Source:\s*(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function formatConditionInstructions(source: string, notes: string): string {
  const header = `Source: ${source.trim() || "Lender"}`;
  const body = notes.trim();
  return body ? `${header}\n${body}` : header;
}
