import {
  sequenceStage,
  type SequenceTask,
} from "@/lib/communications/sequence";
import { isFollowUpDue } from "@/lib/playbooks/logic";

export type WorkloadTask = SequenceTask & {
  assignedTo?: string | null;
  dealId?: string;
};

export type ProcessorWorkload = {
  processorId: string | null;
  processorName: string;
  noContact: number;
  waiting: number;
  followUpOverdue: number;
  escalated: number;
  responseReceived: number;
  total: number;
};

export function summarizeWorkload(
  tasks: WorkloadTask[],
  names: Record<string, string>,
  now = new Date(),
): ProcessorWorkload[] {
  const buckets = new Map<string, ProcessorWorkload>();

  function bucket(id: string | null): ProcessorWorkload {
    const key = id ?? "unassigned";
    const existing = buckets.get(key);
    if (existing) {
      return existing;
    }
    const created: ProcessorWorkload = {
      processorId: id,
      processorName: id ? (names[id] ?? "Assigned processor") : "Unassigned",
      noContact: 0,
      waiting: 0,
      followUpOverdue: 0,
      escalated: 0,
      responseReceived: 0,
      total: 0,
    };
    buckets.set(key, created);
    return created;
  }

  for (const task of tasks) {
    if (task.status === "completed" || task.status === "dismissed") {
      continue;
    }
    const row = bucket(task.assignedTo ?? null);
    const stage = sequenceStage(task, now);
    row.total += 1;
    if (stage === "no_contact") row.noContact += 1;
    if (task.status === "waiting") row.waiting += 1;
    if (
      isFollowUpDue(
        {
          status: task.status,
          nextFollowUpAt: task.nextFollowUpAt ?? null,
          lastContactedAt: task.lastContactedAt ?? null,
          followUpIntervalHours: task.followUpIntervalHours ?? null,
        },
        now,
      )
    ) {
      row.followUpOverdue += 1;
    }
    if (stage === "escalation") row.escalated += 1;
    if (stage === "response_received") row.responseReceived += 1;
  }

  return [...buckets.values()].sort((a, b) => {
    if (a.processorId == null) return 1;
    if (b.processorId == null) return -1;
    return a.processorName.localeCompare(b.processorName);
  });
}
