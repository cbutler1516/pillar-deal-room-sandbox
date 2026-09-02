import {
  DOCUMENT_REVIEW_TYPES,
  type OperationalWorkItem,
  type OperationalWorkType,
} from "@/lib/ops/operational-work";
import { canClaimDeal } from "@/lib/ops/workflow";
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

const DOCUMENT_WORK = new Set<OperationalWorkType>([
  "replacement_received",
  "document_mismatch",
  "document_awaiting_review",
  "document_duplicate",
]);

const REQUEST_WORK = new Set<OperationalWorkType>([
  "required_need_missing",
  "replacement_needed",
]);

export type QueuePrimaryCta =
  | { kind: "inline"; key: InlineSafeAction; label: string }
  | { kind: "navigate"; href: string; label: string };

export type QueueActionPlan = {
  dealId: string;
  taskId: string | null;
  primary: QueuePrimaryCta;
  overflow: QueueInlineActionOffer[];
  canMutate: boolean;
};

function taskIdFrom(row: OperationalWorkItem): string | null {
  return row.sourceKind === "task" ? row.sourceId : null;
}

function isTaskCommunication(row: OperationalWorkItem): boolean {
  return row.sourceKind === "task" && TASK_COMMUNICATION_WORK.has(row.workType);
}

function alreadyWaiting(row: OperationalWorkItem): boolean {
  return (
    row.queueSection === "waiting" ||
    row.waitingState === "contacted_waiting"
  );
}

function allowsMarkWaiting(row: OperationalWorkItem): boolean {
  if (!isTaskCommunication(row)) {
    return false;
  }
  if (row.workType === "response_received") {
    return false;
  }
  if (alreadyWaiting(row) || row.waitingState === "overdue_response") {
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
  if (REQUEST_WORK.has(row.workType)) {
    return true;
  }
  return false;
}

export function queueNavigationLabel(
  row: Pick<
    OperationalWorkItem,
    "workType" | "target" | "recommendedAction" | "title" | "sourceKind"
  >,
): string {
  if (row.target === "conditions") {
    return "Open Condition";
  }
  if (
    row.target === "submission" ||
    row.workType === "ready_to_submit" ||
    row.workType === "near_ready"
  ) {
    return "Open Submission";
  }
  if (DOCUMENT_WORK.has(row.workType)) {
    return "Review Document";
  }
  if (row.target === "needs" || REQUEST_WORK.has(row.workType)) {
    return "Open Request";
  }
  if (row.workType === "required_contact_missing") {
    return "Add contact";
  }
  if (row.workType === "unassigned_file" || row.workType === "new_application") {
    return "Open Deal";
  }
  if (row.workType === "response_received") {
    return "Open Deal";
  }
  if (row.recommendedAction === "Escalate" && row.workType === "escalated_task") {
    return "Open Deal";
  }
  return "Open Deal";
}

function offer(key: InlineSafeAction): QueueInlineActionOffer {
  return { key, label: INLINE_ACTION_LABELS[key] };
}

function pickCommunicationPrimary(offers: InlineSafeAction[]): InlineSafeAction | null {
  return offers[0] ?? null;
}

function orderOffers(
  offers: InlineSafeAction[],
  preferred: InlineSafeAction[],
): InlineSafeAction[] {
  const seen = new Set<InlineSafeAction>();
  const next: InlineSafeAction[] = [];
  for (const key of [...preferred, ...offers]) {
    if (!offers.includes(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(key);
  }
  return next;
}

function communicationOffers(row: OperationalWorkItem): InlineSafeAction[] {
  const offers: InlineSafeAction[] = [];
  if (allowsSetFollowUp(row)) {
    offers.push("set_follow_up");
  }
  if (allowsMarkWaiting(row)) {
    offers.push("mark_waiting");
  }
  if (allowsResponseReceived(row)) {
    offers.push("response_received");
  }
  if (alreadyWaiting(row)) {
    return orderOffers(offers, ["response_received", "set_follow_up"]);
  }
  if (
    row.workType === "follow_up_overdue" ||
    row.workType === "follow_up_due_today" ||
    row.workType === "waiting_beyond_cadence" ||
    row.workType === "escalation_due"
  ) {
    return orderOffers(offers, ["set_follow_up", "response_received", "mark_waiting"]);
  }
  if (
    row.workType === "no_initial_contact" ||
    row.workType === "active_collection" ||
    row.workType === "escalated_task"
  ) {
    return orderOffers(offers, ["mark_waiting", "set_follow_up", "response_received"]);
  }
  return offers;
}

export function deriveQueueActionPlan(
  row: OperationalWorkItem,
  input: { canMutate: boolean; currentUserId: string },
): QueueActionPlan {
  const canMutate = input.canMutate;
  const navigate: QueuePrimaryCta = {
    kind: "navigate",
    href: row.href,
    label: queueNavigationLabel(row),
  };

  if (!canMutate) {
    return {
      dealId: row.dealId,
      taskId: taskIdFrom(row),
      primary: navigate,
      overflow: [],
      canMutate: false,
    };
  }

  const claimable = canClaimDeal(row.assignedProcessorId, input.currentUserId, "processor");
  if (claimable) {
    const overflow = blocksInlineMutation(row)
      ? []
      : communicationOffers(row).map(offer);
    return {
      dealId: row.dealId,
      taskId: taskIdFrom(row),
      primary: { kind: "inline", key: "claim_file", label: INLINE_ACTION_LABELS.claim_file },
      overflow,
      canMutate: true,
    };
  }

  if (blocksInlineMutation(row) || row.target === "conditions") {
    const overflow =
      row.target === "conditions" && isTaskCommunication(row) && !DOCUMENT_REVIEW_TYPES.has(row.workType)
        ? communicationOffers(row).map(offer)
        : [];
    return {
      dealId: row.dealId,
      taskId: taskIdFrom(row),
      primary: navigate,
      overflow,
      canMutate: true,
    };
  }

  const offers = communicationOffers(row);
  const primaryKey = pickCommunicationPrimary(offers);
  if (primaryKey) {
    return {
      dealId: row.dealId,
      taskId: taskIdFrom(row),
      primary: { kind: "inline", key: primaryKey, label: INLINE_ACTION_LABELS[primaryKey] },
      overflow: offers.filter((key) => key !== primaryKey).map(offer),
      canMutate: true,
    };
  }

  return {
    dealId: row.dealId,
    taskId: taskIdFrom(row),
    primary: navigate,
    overflow: [],
    canMutate: true,
  };
}

export function navigationOnlyForWorkType(workType: OperationalWorkType): boolean {
  return (
    DOCUMENT_REVIEW_TYPES.has(workType) ||
    REQUEST_WORK.has(workType) ||
    workType === "required_contact_missing" ||
    workType === "ready_to_submit" ||
    workType === "near_ready"
  );
}

export function assertNoDocumentDecisionPath(primary: QueuePrimaryCta): boolean {
  return primary.kind !== "inline";
}

export function assertNoConditionClearInOffers(offers: QueueInlineActionOffer[]): boolean {
  return !offers.some((offer) => /clear/i.test(offer.label) || offer.key === ("clear_condition" as never));
}

export function planHasClaim(plan: QueueActionPlan): boolean {
  return (
    (plan.primary.kind === "inline" && plan.primary.key === "claim_file") ||
    plan.overflow.some((item) => item.key === "claim_file")
  );
}
