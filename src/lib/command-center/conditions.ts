import {
  conditionStatus,
  isLenderCondition,
  type ConditionStatus,
} from "@/lib/conditions/model";
import { queueFilterHref } from "@/lib/command-center/filters";

export type ConditionsSnapshot = {
  open: number;
  waiting: number;
  received: number;
  needsReview: number;
  href: string;
};

export function deriveConditionsSnapshot(input: {
  tasks: {
    id: string;
    status: string;
    sourceType?: string | null;
    taskKind?: string | null;
    playbookKey?: string | null;
    clientNeedId?: string | null;
  }[];
  needs: { id: string; status: string }[];
}): ConditionsSnapshot {
  const counts: Record<ConditionStatus, number> = {
    open: 0,
    waiting: 0,
    received: 0,
    needs_review: 0,
    cleared: 0,
  };

  for (const task of input.tasks) {
    if (!isLenderCondition(task)) {
      continue;
    }
    const need = input.needs.find((row) => row.id === task.clientNeedId);
    const status = conditionStatus(task, need);
    if (status !== "cleared") {
      counts[status] += 1;
    }
  }

  return {
    open: counts.open,
    waiting: counts.waiting,
    received: counts.received,
    needsReview: counts.needs_review,
    href: queueFilterHref({ bucket: "review", work: "review" }),
  };
}
