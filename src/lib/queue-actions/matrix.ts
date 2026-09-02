/**
 * Audited server-action matrix for Queue Action Layer V1.
 * Only actions listed under INLINE_SAFE may be invoked from Queue / Command Center cards.
 */

export const INLINE_SAFE_ACTIONS = [
  "claim_file",
  "mark_waiting",
  "set_follow_up",
  "response_received",
] as const;

export type InlineSafeAction = (typeof INLINE_SAFE_ACTIONS)[number];

export const NAVIGATION_ONLY_ACTIONS = [
  "review_document",
  "approve_document",
  "reject_document",
  "attach_document",
  "detach_document",
  "add_contact",
  "clear_condition",
  "prepare_submission",
  "mark_submitted",
  "edit_borrower",
  "follow_up_navigate",
  "open_file",
  "review_reply",
  "escalate",
  "mark_contacted",
  "complete_task",
  "dismiss_task",
] as const;

export type NavigationOnlyAction = (typeof NAVIGATION_ONLY_ACTIONS)[number];

/** Maps inline-safe keys to existing audited server actions. */
export const INLINE_ACTION_SERVER_MAP = {
  claim_file: {
    module: "@/lib/workflow/actions",
    action: "claimDealAction",
    fields: ["dealId"],
  },
  mark_waiting: {
    module: "@/lib/communications/actions",
    action: "markTaskWaitingWithCadenceAction",
    fields: ["taskId"],
  },
  set_follow_up: {
    module: "@/lib/communications/actions",
    action: "scheduleFollowUpAction",
    fields: ["taskId", "nextFollowUpAt"],
  },
  response_received: {
    module: "@/lib/communications/actions",
    action: "markResponseReceivedAction",
    fields: ["taskId"],
  },
} as const satisfies Record<
  InlineSafeAction,
  { module: string; action: string; fields: readonly string[] }
>;

/**
 * Full server-action audit (existing codebase):
 *
 * INLINE-SAFE (wired in this PR):
 * - claimDealAction
 * - markTaskWaitingWithCadenceAction (same patch as markTaskWaitingAction)
 * - scheduleFollowUpAction (same behavior as setTaskFollowUpAction)
 * - markResponseReceivedAction
 *
 * NAVIGATION-ONLY (deal workspace):
 * - unclaimDealAction, updateDealStatusAction, markSubmittedAction
 * - updateNeedStatusAction, updateDocumentStatusAction, classifyDocumentAction
 * - attachExistingAction, detachExistingAction, cloneClientNeedAction
 * - createDealContactAction, updateDealContactAction, clearConditionAction
 * - markTaskContactedWithCommunicationAction (requires draft/channel context)
 * - completeTaskAction, dismissTaskAction, escalateTaskAction
 * - updateTaskStatusAction, startTaskAction, createTaskFromPlaybookAction
 * - simulateInboundResponseAction, recordDraftCopiedAction
 * - AI rewrite, upload session actions, portal/application actions
 */

export function isInlineSafeAction(value: string): value is InlineSafeAction {
  return INLINE_SAFE_ACTIONS.includes(value as InlineSafeAction);
}

export type QueueInlineActionOffer = {
  key: InlineSafeAction;
  label: string;
};

export const INLINE_ACTION_LABELS: Record<InlineSafeAction, string> = {
  claim_file: "Claim file",
  mark_waiting: "Mark waiting",
  set_follow_up: "Set follow-up",
  response_received: "Response received",
};

export const INLINE_SUCCESS_MESSAGES: Record<InlineSafeAction, string> = {
  claim_file: "Claimed",
  mark_waiting: "Marked waiting",
  set_follow_up: "Follow-up set",
  response_received: "Response recorded",
};

export const QUEUE_ACTION_ERROR_MESSAGE =
  "Couldn't update this item. Nothing was changed.";
