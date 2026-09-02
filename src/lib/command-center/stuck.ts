import { isLenderCondition } from "@/lib/conditions/model";
import type { OperationalTask } from "@/lib/ops/operational-work";
import {
  type OperationalWorkItem,
  workItemMatchesFilter,
} from "@/lib/ops/operational-work";
import { humanizeWorkReason } from "@/lib/ui/staff-copy";
import { workItemAgeLabel } from "@/lib/command-center/aging";

const STUCK_WORK_TYPES = new Set<OperationalWorkItem["workType"]>([
  "follow_up_overdue",
  "waiting_beyond_cadence",
  "replacement_needed",
  "required_contact_missing",
  "escalated_task",
  "escalation_due",
  "required_need_missing",
]);

export type StuckFileRow = {
  id: string;
  dealId: string;
  borrowerName: string;
  reason: string;
  ageLabel: string | null;
  href: string;
};

function isOpenConditionBeyondFollowUp(
  row: OperationalWorkItem,
  tasks: OperationalTask[],
): boolean {
  if (row.sourceKind !== "task") {
    return false;
  }
  const task = tasks.find((item) => item.id === row.sourceId);
  if (!task || !isLenderCondition(task)) {
    return false;
  }
  return (
    row.workType === "follow_up_overdue" ||
    row.workType === "waiting_beyond_cadence"
  );
}

export function isStuckWorkItem(
  row: OperationalWorkItem,
  tasks: OperationalTask[],
): boolean {
  if (STUCK_WORK_TYPES.has(row.workType)) {
    return true;
  }
  if (isOpenConditionBeyondFollowUp(row, tasks)) {
    return true;
  }
  if (
    row.workType === "waiting_on_response" &&
    row.waitingState === "overdue_response"
  ) {
    return true;
  }
  return false;
}

export function deriveStuckFiles(input: {
  items: OperationalWorkItem[];
  tasks: OperationalTask[];
  limit?: number;
  now?: Date;
}): StuckFileRow[] {
  const limit = input.limit ?? 6;
  const seen = new Set<string>();
  const rows: StuckFileRow[] = [];

  for (const row of input.items) {
    if (!isStuckWorkItem(row, input.tasks)) {
      continue;
    }
    if (seen.has(row.dealId)) {
      continue;
    }
    seen.add(row.dealId);
    rows.push({
      id: row.id,
      dealId: row.dealId,
      borrowerName: row.borrowerName,
      reason: humanizeWorkReason(row.reason),
      ageLabel: workItemAgeLabel({
        dueState: row.dueState,
        dueAt: row.dueAt,
        workType: row.workType,
        reason: row.reason,
        now: input.now,
      }),
      href: `/deals/${row.dealId}`,
    });
    if (rows.length >= limit) {
      break;
    }
  }

  return rows;
}

export function countStuckFiles(
  items: OperationalWorkItem[],
  tasks: OperationalTask[],
): number {
  const dealIds = new Set<string>();
  for (const row of items) {
    if (isStuckWorkItem(row, tasks)) {
      dealIds.add(row.dealId);
    }
  }
  return dealIds.size;
}

export function stuckMatchesAttentionFilter(
  row: OperationalWorkItem,
): boolean {
  return workItemMatchesFilter(row, "follow_up") || workItemMatchesFilter(row, "replacement");
}
