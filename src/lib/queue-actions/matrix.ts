/**
 * Audited server-action matrix for Queue Action Layer V1.
 * Inline Work actions call existing mutations only. No new workflow engine.
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
  "open_condition",
  "open_submission",
  "open_request",
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
 * - markTaskWaitingWithCadenceAction
 * - scheduleFollowUpAction
 * - markResponseReceivedAction
 *
 * NAVIGATION-ONLY (deal workspace — not invoked from Work):
 * - unclaimDealAction, updateDealStatusAction, markSubmittedAction
 * - updateNeedStatusAction, updateDocumentStatusAction, classifyDocumentAction
 * - attachExistingAction, detachExistingAction, cloneClientNeedAction
 * - createDealContactAction, updateDealContactAction, clearConditionAction
 * - markTaskContactedWithCommunicationAction (would imply outreach)
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
  claim_file: "Claim File",
  mark_waiting: "Mark Waiting",
  set_follow_up: "Set Follow-Up",
  response_received: "Mark Reply Received",
};

export const INLINE_SUCCESS_MESSAGES: Record<InlineSafeAction, string> = {
  claim_file: "File claimed",
  mark_waiting: "Waiting",
  set_follow_up: "Follow-up set",
  response_received: "Reply received",
};

export const INLINE_ERROR_MESSAGES: Record<InlineSafeAction, string> = {
  claim_file: "Couldn't claim this file.",
  mark_waiting: "Couldn't mark waiting.",
  set_follow_up: "Couldn't update follow-up.",
  response_received: "Couldn't mark reply received.",
};

export function feedbackForQueueAction(
  result: { error: string | null },
  action: InlineSafeAction,
): { tone: "success" | "error"; message: string } {
  if (result.error) {
    return { tone: "error", message: INLINE_ERROR_MESSAGES[action] };
  }
  return { tone: "success", message: INLINE_SUCCESS_MESSAGES[action] };
}

/**
 * Work filters live on the current URL. Mutations revalidate `/processor-queue`
 * and `/dashboard` in place. The client must `router.refresh()` and must not
 * `push`/`replace` query params.
 */
export const QUEUE_ACTION_KEEPS_QUERY = true;
export const QUEUE_ACTION_REFRESH_STRATEGY = "router.refresh" as const;
