import type {
  AutomationRecommendation,
  DraftType,
  FollowUpRule,
  SequenceStage,
} from "@/lib/communications/types";
import {
  isActiveTaskStatus,
  isEscalationDue,
  isFollowUpDue,
} from "@/lib/playbooks/logic";

export const FAST_CADENCE_SOURCES = new Set([
  "borrower",
  "title",
  "insurance",
  "escrow",
]);

export type SequenceTask = {
  status: string;
  sourceType?: string | null;
  lastContactedAt?: string | null;
  lastResponseAt?: string | null;
  nextFollowUpAt?: string | null;
  waitingSince?: string | null;
  followUpIntervalHours?: number | null;
  escalationAfterHours?: number | null;
  escalationLevel?: string | null;
  createdAt?: string | null;
};

function followUpInput(task: SequenceTask) {
  return {
    status: task.status,
    nextFollowUpAt: task.nextFollowUpAt ?? null,
    lastContactedAt: task.lastContactedAt ?? null,
    followUpIntervalHours: task.followUpIntervalHours ?? null,
  };
}

function escalationInput(task: SequenceTask) {
  return {
    status: task.status,
    escalationAfterHours: task.escalationAfterHours ?? null,
    escalationLevel: task.escalationLevel ?? null,
    lastContactedAt: task.lastContactedAt ?? null,
    waitingSince: task.waitingSince ?? null,
    createdAt: task.createdAt ?? null,
  };
}

export function defaultFollowUpRule(sourceType: string | null | undefined): FollowUpRule {
  if (FAST_CADENCE_SOURCES.has(sourceType ?? "")) {
    return { followUpHours: 24, escalationHours: 48, source: "default" };
  }
  return { followUpHours: 48, escalationHours: 96, source: "default" };
}

export function resolveFollowUpRule(
  task: Pick<
    SequenceTask,
    "sourceType" | "followUpIntervalHours" | "escalationAfterHours"
  >,
): FollowUpRule {
  const fallback = defaultFollowUpRule(task.sourceType);
  const followUpHours =
    task.followUpIntervalHours && task.followUpIntervalHours > 0
      ? task.followUpIntervalHours
      : fallback.followUpHours;
  const escalationHours =
    task.escalationAfterHours && task.escalationAfterHours > 0
      ? task.escalationAfterHours
      : fallback.escalationHours;
  return {
    followUpHours,
    escalationHours,
    source:
      task.followUpIntervalHours || task.escalationAfterHours ? "task" : "default",
  };
}

export function sequenceTaskForCadence(task: SequenceTask): SequenceTask {
  const rule = resolveFollowUpRule(task);
  return {
    ...task,
    followUpIntervalHours: task.followUpIntervalHours ?? rule.followUpHours,
    escalationAfterHours: task.escalationAfterHours ?? rule.escalationHours,
  };
}

function hasSecondFollowUpWindow(task: SequenceTask, now: Date): boolean {
  if (!task.lastContactedAt) {
    return false;
  }
  const rule = resolveFollowUpRule(task);
  const elapsed =
    now.getTime() - new Date(task.lastContactedAt).getTime();
  return elapsed >= rule.followUpHours * 2 * 3_600_000;
}

export function sequenceStage(task: SequenceTask, now = new Date()): SequenceStage {
  if (task.status === "completed" || task.status === "dismissed") {
    return "complete";
  }
  if (task.lastResponseAt) {
    return "response_received";
  }
  const ranked = sequenceTaskForCadence(task);
  if (isEscalationDue(escalationInput(ranked), now)) {
    return "escalation";
  }
  if (isFollowUpDue(followUpInput(ranked), now) && hasSecondFollowUpWindow(ranked, now)) {
    return "second_follow_up";
  }
  if (isFollowUpDue(followUpInput(ranked), now)) {
    return "follow_up";
  }
  if (task.status === "waiting") {
    return "waiting";
  }
  return "no_contact";
}

export function recommendedDraftType(
  task: SequenceTask,
  options: { replacementNeeded?: boolean } = {},
  now = new Date(),
): DraftType | null {
  if (options.replacementNeeded) {
    return "replacement";
  }
  switch (sequenceStage(task, now)) {
    case "no_contact":
      return "initial";
    case "waiting":
    case "follow_up":
      return "follow_up";
    case "second_follow_up":
      return "second_follow_up";
    case "escalation":
      return "escalation";
    case "response_received":
      return "thank_you";
    case "complete":
      return null;
  }
}

export function recommendedDraftForTask(
  task: SequenceTask,
  options: { replacementNeeded?: boolean } = {},
  now = new Date(),
): AutomationRecommendation {
  const stage = sequenceStage(task, now);
  const draftType = recommendedDraftType(task, options, now);
  return {
    stage,
    draftType,
    reason: recommendationReason(stage, options.replacementNeeded === true),
    provider: null,
    executable: false,
  };
}

function recommendationReason(stage: SequenceStage, replacement: boolean): string {
  if (replacement) {
    return "A required Client Need needs a replacement. Copy borrower-safe wording only.";
  }
  switch (stage) {
    case "no_contact":
      return "No contact has been recorded. Copy the initial request.";
    case "waiting":
      return "Waiting on a response. Follow the cadence; nothing is sent automatically.";
    case "follow_up":
      return "Follow-up is due. Copy the follow-up draft.";
    case "second_follow_up":
      return "A second follow-up is due. Copy the reminder draft.";
    case "escalation":
      return "Escalation is due. Copy the escalation draft for internal use.";
    case "response_received":
      return "A response was recorded. Review it; the task is not complete.";
    case "complete":
      return "This task is complete.";
  }
}

export function isExternalRequestSource(sourceType: string | null | undefined): boolean {
  return (
    sourceType === "borrower" ||
    sourceType === "insurance" ||
    sourceType === "title" ||
    sourceType === "escrow" ||
    sourceType === "contractor" ||
    sourceType === "property_manager" ||
    sourceType === "cpa" ||
    sourceType === "other"
  );
}

export function isActiveExternalRequest(task: SequenceTask): boolean {
  return isActiveTaskStatus(task.status) && isExternalRequestSource(task.sourceType);
}
