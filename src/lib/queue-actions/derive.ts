import {
  DOCUMENT_REVIEW_TYPES,
  type OperationalSourceKind,
  type OperationalWaitingState,
  type OperationalWorkItem,
  type OperationalWorkType,
} from "@/lib/ops/operational-work";
import {
  INLINE_ACTION_LABELS,
  type InlineSafeAction,
  type QueueInlineActionOffer,
} from "@/lib/queue-actions/matrix";

const TASK_COMMUNICATION_WORK = new Set<OperationalWorkType>([
  "escalated_task",
  "escalation_due",
  "follow_up_overdue",
  "follow_up_due_today",
  "waiting_on_response",
  "waiting_beyond_cadence",
  "no_initial_contact",
  "active_collection",
]);

const DOCUMENT_OR_DEAL_WORK = new Set<OperationalWorkType>([
  "replacement_needed",
  "replacement_received",
  "document_mismatch",
  "document_awaiting_review",
  "document_duplicate",
  "required_need_missing",
  "ready_to_submit",
  "near_ready",
  "new_application",
  "unassigned_file",
]);

export type QueueActionPlan = {
  dealId: string;
  taskId: string | null;
  primaryHref: string;
  primaryLabel: string;
  primaryInline: InlineSafeAction | null;
  secondary: QueueInlineActionOffer[];
  canMutate: boolean;
};

function taskIdFrom(row: OperationalWorkItem): string | null {
  return row.sourceKind === "task" ? row.sourceId : null;
}

function canClaim(row: OperationalWorkItem): boolean {
  return (
    !row.assignedProcessorId &&
    (row.workType === "unassigned_file" ||
      row.workType === "new_application" ||
      row.recommendedAction.toLowerCase() === "claim")
  );
}

function isTaskCommunication(row: OperationalWorkItem): boolean {
  return row.sourceKind === "task" && TASK_COMMUNICATION_WORK.has(row.workType);
}

function allowsMarkWaiting(row: OperationalWorkItem): boolean {
  if (!isTaskCommunication(row)) {
    return false;
  }
  if (row.workType === "response_received") {
    return false;
  }
  return row.waitingState !== "response_received";
}

function allowsSetFollowUp(row: OperationalWorkItem): boolean {
  if (!isTaskCommunication(row)) {
    return false;
  }
  return row.workType !== "response_received";
}

function allowsResponseReceived(row: OperationalWorkItem): boolean {
  if (row.sourceKind !== "task") {
    return false;
  }
  if (row.workType === "response_received") {
    return false;
  }
  return (
    row.waitingState === "contacted_waiting" ||
    row.waitingState === "overdue_response" ||
    row.queueSection === "waiting" ||
    TASK_COMMUNICATION_WORK.has(row.workType)
  );
}

function blocksInlineMutation(row: OperationalWorkItem): boolean {
  if (DOCUMENT_REVIEW_TYPES.has(row.workType)) {
    return true;
  }
  if (row.workType === "required_contact_missing") {
    return true;
  }
  if (row.workType === "ready_to_submit" || row.workType === "near_ready") {
    return true;
  }
  if (row.target === "conditions" && row.workType !== "follow_up_overdue") {
    return false;
  }
  return false;
}

export function deriveQueueActionPlan(
  row: OperationalWorkItem,
  input: { canMutate: boolean } = { canMutate: true },
): QueueActionPlan {
  const secondary: QueueInlineActionOffer[] = [];
  let primaryInline: InlineSafeAction | null = null;

  if (input.canMutate && canClaim(row)) {
    primaryInline = "claim_file";
  }

  if (input.canMutate && !blocksInlineMutation(row)) {
    if (allowsMarkWaiting(row)) {
      secondary.push({ key: "mark_waiting", label: INLINE_ACTION_LABELS.mark_waiting });
    }
    if (allowsSetFollowUp(row)) {
      secondary.push({ key: "set_follow_up", label: INLINE_ACTION_LABELS.set_follow_up });
    }
    if (allowsResponseReceived(row)) {
      secondary.push({
        key: "response_received",
        label: INLINE_ACTION_LABELS.response_received,
      });
    }
  }

  if (
    input.canMutate &&
    row.target === "conditions" &&
    isTaskCommunication(row) &&
    !secondary.some((item) => item.key === "mark_waiting")
  ) {
    if (allowsMarkWaiting(row)) {
      secondary.unshift({ key: "mark_waiting", label: INLINE_ACTION_LABELS.mark_waiting });
    }
    if (allowsSetFollowUp(row)) {
      secondary.push({ key: "set_follow_up", label: INLINE_ACTION_LABELS.set_follow_up });
    }
  }

  return {
    dealId: row.dealId,
    taskId: taskIdFrom(row),
    primaryHref: row.href,
    primaryLabel: row.recommendedAction,
    primaryInline,
    secondary: dedupeSecondary(secondary),
    canMutate: input.canMutate,
  };
}

function dedupeSecondary(items: QueueInlineActionOffer[]): QueueInlineActionOffer[] {
  const seen = new Set<InlineSafeAction>();
  return items.filter((item) => {
    if (seen.has(item.key)) {
      return false;
    }
    seen.add(item.key);
    return true;
  });
}

export function navigationOnlyForWorkType(workType: OperationalWorkType): boolean {
  return (
    DOCUMENT_REVIEW_TYPES.has(workType) ||
    DOCUMENT_OR_DEAL_WORK.has(workType) ||
    workType === "required_contact_missing"
  );
}

export function assertNoDocumentDecisionPath(action: InlineSafeAction | null): boolean {
  return action === null;
}

export function assertNoConditionClearInOffers(offers: QueueInlineActionOffer[]): boolean {
  return !offers.some((offer) => offer.label.toLowerCase().includes("clear"));
}

export type QueueActionRowMeta = {
  workType: OperationalWorkType;
  sourceKind: OperationalSourceKind;
  waitingState: OperationalWaitingState;
};

export function queueActionMeta(row: OperationalWorkItem): QueueActionRowMeta {
  return {
    workType: row.workType,
    sourceKind: row.sourceKind,
    waitingState: row.waitingState,
  };
}
