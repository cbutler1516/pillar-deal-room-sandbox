import {
  resolveFollowUpRule,
  sequenceStage,
  sequenceTaskForCadence,
  type SequenceTask,
} from "@/lib/communications/sequence";
import { hoursSince, isFollowUpDue } from "@/lib/playbooks/logic";

function followUpInput(task: SequenceTask) {
  return {
    status: task.status,
    nextFollowUpAt: task.nextFollowUpAt ?? null,
    lastContactedAt: task.lastContactedAt ?? null,
    followUpIntervalHours: task.followUpIntervalHours ?? null,
  };
}

export type CommunicationAging = {
  stage: ReturnType<typeof sequenceStage>;
  hoursSinceContact: number | null;
  hoursWaiting: number | null;
  hoursSinceResponse: number | null;
  followUpHours: number;
  escalationHours: number;
  followUpOverdue: boolean;
  label: string;
};

export function communicationAging(
  task: SequenceTask,
  now = new Date(),
): CommunicationAging {
  const rule = resolveFollowUpRule(task);
  const ranked = sequenceTaskForCadence(task);
  const stage = sequenceStage(task, now);
  const hoursSinceContact = task.lastContactedAt
    ? hoursSince(task.lastContactedAt, now)
    : null;
  const hoursWaiting =
    task.status === "waiting" && task.waitingSince
      ? hoursSince(task.waitingSince, now)
      : null;
  const hoursSinceResponse = task.lastResponseAt
    ? hoursSince(task.lastResponseAt, now)
    : null;
  const followUpOverdue = isFollowUpDue(followUpInput(ranked), now);
  return {
    stage,
    hoursSinceContact,
    hoursWaiting,
    hoursSinceResponse,
    followUpHours: rule.followUpHours,
    escalationHours: rule.escalationHours,
    followUpOverdue,
    label: agingLabel(stage, followUpOverdue, rule.followUpHours),
  };
}

function agingLabel(
  stage: ReturnType<typeof sequenceStage>,
  followUpOverdue: boolean,
  followUpHours: number,
): string {
  if (stage === "escalation") {
    return "Escalation due";
  }
  if (followUpOverdue) {
    return "Follow-up overdue";
  }
  if (stage === "waiting") {
    return `Waiting · ${followUpHours}h cadence`;
  }
  if (stage === "no_contact") {
    return "No contact recorded";
  }
  if (stage === "response_received") {
    return "Reply received — review";
  }
  return "On cadence";
}

export function formatHoursCompact(hours: number | null): string {
  if (hours == null) {
    return "—";
  }
  if (hours < 1) {
    return "<1h";
  }
  if (hours < 24) {
    return `${Math.round(hours)}h`;
  }
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem === 0 ? `${days}d` : `${days}d ${rem}h`;
}
