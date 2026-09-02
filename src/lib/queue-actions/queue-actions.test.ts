import { describe, expect, it } from "vitest";
import { responseReceivedTaskPatch } from "@/lib/communications/records";
import { markTaskWaitingPatch } from "@/lib/contacts/logic";
import type { OperationalWorkItem } from "@/lib/ops/operational-work";
import { canClaimDeal, canMutateWorkflow } from "@/lib/ops/workflow";
import {
  assertNoConditionClearInOffers,
  assertNoDocumentDecisionPath,
  deriveQueueActionPlan,
  navigationOnlyForWorkType,
  planHasClaim,
  queueNavigationLabel,
} from "@/lib/queue-actions/derive";
import {
  followUpPresets,
  formatFollowUpDisplay,
  parseCustomFollowUpInput,
  staffDatetimeLocalValue,
} from "@/lib/queue-actions/follow-up-presets";
import {
  INLINE_ACTION_SERVER_MAP,
  INLINE_SAFE_ACTIONS,
  NAVIGATION_ONLY_ACTIONS,
  QUEUE_ACTION_KEEPS_QUERY,
  QUEUE_ACTION_REFRESH_STRATEGY,
  feedbackForQueueAction,
  isInlineSafeAction,
} from "@/lib/queue-actions/matrix";

const NOW = new Date("2026-09-02T18:00:00.000Z");
const ME = "proc-chris";

function work(
  partial: Partial<OperationalWorkItem> &
    Pick<OperationalWorkItem, "id" | "workType" | "queueSection">,
): OperationalWorkItem {
  return {
    dealId: "deal-1",
    dealReference: "PDR-SBX-001",
    borrowerName: "Casey Nguyen",
    entityName: null,
    loanType: "Fix & Flip",
    title: "Insurance",
    reason: "Follow-up overdue by 2 days",
    recommendedAction: "Follow up",
    priorityBand: "high",
    priorityRank: 5,
    dueState: "overdue",
    sourceKind: "task",
    sourceId: partial.id,
    assignedProcessorId: ME,
    waitingState: "overdue_response",
    dueAt: "2026-08-29T18:00:00.000Z",
    href: "/deals/deal-1?tab=tasks",
    target: "tasks",
    ...partial,
  };
}

function plan(row: OperationalWorkItem, extra?: { canMutate?: boolean; currentUserId?: string }) {
  return deriveQueueActionPlan(row, {
    canMutate: extra?.canMutate ?? true,
    currentUserId: extra?.currentUserId ?? ME,
  });
}

describe("action allowlist audit", () => {
  it("defines only four inline-safe server-backed actions", () => {
    expect(INLINE_SAFE_ACTIONS).toEqual([
      "claim_file",
      "mark_waiting",
      "set_follow_up",
      "response_received",
    ]);
    expect(INLINE_ACTION_SERVER_MAP.claim_file.action).toBe("claimDealAction");
    expect(INLINE_ACTION_SERVER_MAP.mark_waiting.action).toBe(
      "markTaskWaitingWithCadenceAction",
    );
    expect(INLINE_ACTION_SERVER_MAP.set_follow_up.action).toBe("scheduleFollowUpAction");
    expect(INLINE_ACTION_SERVER_MAP.response_received.action).toBe(
      "markResponseReceivedAction",
    );
  });

  it("keeps sensitive workflows navigation-only", () => {
    expect(NAVIGATION_ONLY_ACTIONS).toContain("approve_document");
    expect(NAVIGATION_ONLY_ACTIONS).toContain("clear_condition");
    expect(NAVIGATION_ONLY_ACTIONS).toContain("mark_submitted");
    expect(NAVIGATION_ONLY_ACTIONS).toContain("mark_contacted");
    expect(isInlineSafeAction("approve_document")).toBe(false);
  });
});

describe("claim file", () => {
  it("offers inline claim for an unassigned file", () => {
    const next = plan(
      work({
        id: "u1",
        workType: "unassigned_file",
        queueSection: "new",
        assignedProcessorId: null,
        recommendedAction: "Claim",
        sourceKind: "deal",
        sourceId: "deal-1",
        href: "/deals/deal-1",
        target: "tasks",
      }),
    );
    expect(next.primary).toEqual({
      kind: "inline",
      key: "claim_file",
      label: "Claim File",
    });
  });

  it("hides claim when the file is already assigned to the current user", () => {
    expect(canClaimDeal(ME, ME, "processor")).toBe(false);
    const next = plan(
      work({
        id: "t1",
        workType: "follow_up_overdue",
        queueSection: "due_today",
        assignedProcessorId: ME,
      }),
    );
    expect(planHasClaim(next)).toBe(false);
  });

  it("does not offer unauthorized takeover of another user's file", () => {
    expect(canClaimDeal("proc-other", ME, "processor")).toBe(false);
    expect(canClaimDeal("proc-other", ME, "admin")).toBe(false);
    const next = plan(
      work({
        id: "t1",
        workType: "follow_up_overdue",
        queueSection: "due_today",
        assignedProcessorId: "proc-other",
      }),
    );
    expect(planHasClaim(next)).toBe(false);
  });
});

describe("mark waiting", () => {
  it("offers mark waiting for communication task work that is not already waiting", () => {
    const next = plan(
      work({
        id: "ins-1",
        workType: "no_initial_contact",
        queueSection: "due_today",
        waitingState: "not_yet_requested",
        title: "Insurance binder",
      }),
    );
    const keys =
      next.primary.kind === "inline"
        ? [next.primary.key, ...next.overflow.map((item) => item.key)]
        : next.overflow.map((item) => item.key);
    expect(keys).toContain("mark_waiting");
  });

  it("reuses existing waiting patch semantics", () => {
    const patch = markTaskWaitingPatch({
      nowIso: NOW.toISOString(),
      followUpIntervalHours: 24,
      sourceType: "borrower",
    });
    expect(patch.status).toBe("waiting");
    expect(patch.waiting_since).toBe(NOW.toISOString());
    expect(patch.completed_at).toBeNull();
  });
});

describe("set follow-up", () => {
  it("offers set follow-up for overdue communication work", () => {
    const next = plan(
      work({
        id: "ins-1",
        workType: "follow_up_overdue",
        queueSection: "due_today",
        waitingState: "overdue_response",
      }),
    );
    expect(next.primary).toMatchObject({ kind: "inline", key: "set_follow_up" });
  });

  it("builds Tomorrow / 2 Days / Next Week presets in the staff clock", () => {
    const presets = followUpPresets(NOW);
    expect(presets.map((row) => row.label)).toEqual(["Tomorrow", "2 Days", "Next Week"]);
    expect(presets[0]?.displayDate).toMatch(/Sep/);
    expect(staffDatetimeLocalValue(presets[0]!.iso)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("parses Choose Date without accepting past times", () => {
    const iso = parseCustomFollowUpInput("2026-09-04T10:00", NOW);
    expect(iso).toBeTruthy();
    expect(formatFollowUpDisplay(iso!)).toMatch(/Sep/);
    expect(parseCustomFollowUpInput("2026-08-01T10:00", NOW)).toBeNull();
  });
});

describe("reply received", () => {
  it("offers mark reply received for waiting communication tasks", () => {
    const next = plan(
      work({
        id: "w1",
        workType: "waiting_on_response",
        queueSection: "waiting",
        waitingState: "contacted_waiting",
      }),
    );
    const keys =
      next.primary.kind === "inline"
        ? [next.primary.key, ...next.overflow.map((item) => item.key)]
        : next.overflow.map((item) => item.key);
    expect(keys).toContain("response_received");
    expect(next.primary).toMatchObject({ kind: "inline", key: "response_received" });
  });

  it("does not auto-complete a need, document, or unrelated task on the response patch", () => {
    const patch = responseReceivedTaskPatch(NOW.toISOString());
    expect(patch.status).toBe("in_progress");
    expect(patch.waiting_since).toBeNull();
    expect(patch.completed_at).toBeNull();
    expect(patch.last_response_at).toBeTruthy();
    expect(patch).not.toHaveProperty("need_status");
    expect(patch).not.toHaveProperty("document_status");
    expect(Object.keys(patch).sort()).toEqual(
      ["completed_at", "last_response_at", "status", "waiting_since"].sort(),
    );
  });
});

describe("queue re-derivation after action", () => {
  it("does not invent section or priority placement on the action plan", () => {
    const next = plan(
      work({
        id: "t1",
        workType: "follow_up_overdue",
        queueSection: "urgent",
        priorityRank: 2,
      }),
    );
    expect(next).not.toHaveProperty("queueSection");
    expect(next).not.toHaveProperty("priorityRank");
    expect(QUEUE_ACTION_REFRESH_STRATEGY).toBe("router.refresh");
  });
});

describe("filter and query preservation", () => {
  it("keeps Work query params by refreshing in place", () => {
    expect(QUEUE_ACTION_KEEPS_QUERY).toBe(true);
    expect(QUEUE_ACTION_REFRESH_STRATEGY).toBe("router.refresh");
    expect(INLINE_ACTION_SERVER_MAP.set_follow_up.fields).toEqual(["taskId", "nextFollowUpAt"]);
    expect(INLINE_ACTION_SERVER_MAP.claim_file.fields).toEqual(["dealId"]);
  });
});

describe("navigation-only actions", () => {
  it("reviews documents by navigating only", () => {
    const next = plan(
      work({
        id: "doc-1",
        workType: "document_awaiting_review",
        queueSection: "needs_review",
        sourceKind: "document",
        sourceId: "doc-1",
        recommendedAction: "Review",
        href: "/deals/deal-1?tab=documents",
        target: "documents",
      }),
    );
    expect(next.primary).toEqual({
      kind: "navigate",
      href: "/deals/deal-1?tab=documents",
      label: "Review Document",
    });
    expect(next.overflow).toEqual([]);
    expect(navigationOnlyForWorkType("document_awaiting_review")).toBe(true);
    expect(assertNoDocumentDecisionPath(next.primary)).toBe(true);
  });

  it("opens conditions by navigating only and never clears inline", () => {
    const next = plan(
      work({
        id: "c1",
        workType: "follow_up_overdue",
        queueSection: "due_today",
        target: "conditions",
        href: "/deals/deal-1?tab=conditions",
      }),
    );
    expect(next.primary).toEqual({
      kind: "navigate",
      href: "/deals/deal-1?tab=conditions",
      label: "Open Condition",
    });
    expect(assertNoConditionClearInOffers(next.overflow)).toBe(true);
    expect(queueNavigationLabel(work({ id: "c1", workType: "follow_up_overdue", queueSection: "due_today", target: "conditions" }))).toBe(
      "Open Condition",
    );
  });

  it("opens submission by navigating only and does not mark submitted", () => {
    const next = plan(
      work({
        id: "ready",
        workType: "ready_to_submit",
        queueSection: "due_today",
        sourceKind: "deal",
        recommendedAction: "Prepare submission",
        target: "submission",
        href: "/deals/deal-1?tab=submission",
      }),
    );
    expect(next.primary).toEqual({
      kind: "navigate",
      href: "/deals/deal-1?tab=submission",
      label: "Open Submission",
    });
    expect(next.overflow).toEqual([]);
    expect(isInlineSafeAction("mark_submitted")).toBe(false);
  });

  it("opens requests by navigating only", () => {
    const next = plan(
      work({
        id: "need-1",
        workType: "required_need_missing",
        queueSection: "due_today",
        sourceKind: "need",
        recommendedAction: "Collect",
        target: "needs",
        href: "/deals/deal-1?tab=needs",
      }),
    );
    expect(next.primary).toEqual({
      kind: "navigate",
      href: "/deals/deal-1?tab=needs",
      label: "Open Request",
    });
    expect(next.overflow).toEqual([]);
  });
});

describe("failure does not show false success", () => {
  it("maps a failed save to an error tone and never a success message", () => {
    const failed = feedbackForQueueAction({ error: "Unable to claim this deal." }, "claim_file");
    expect(failed.tone).toBe("error");
    expect(failed.message).toBe("Couldn't claim this file.");
    expect(failed.message.toLowerCase()).not.toContain("claimed");

    const follow = feedbackForQueueAction({ error: "db" }, "set_follow_up");
    expect(follow).toEqual({ tone: "error", message: "Couldn't update follow-up." });

    const ok = feedbackForQueueAction({ error: null }, "claim_file");
    expect(ok).toEqual({ tone: "success", message: "File claimed" });
  });
});

describe("authorization", () => {
  it("requires processor/admin workflow mutation rights", () => {
    expect(canMutateWorkflow("processor")).toBe(true);
    expect(canMutateWorkflow("loan_officer")).toBe(false);
  });

  it("disables inline actions when canMutate is false", () => {
    const next = plan(
      work({
        id: "u1",
        workType: "unassigned_file",
        queueSection: "new",
        assignedProcessorId: null,
        recommendedAction: "Claim",
        sourceKind: "deal",
        sourceId: "deal-1",
      }),
      { canMutate: false },
    );
    expect(next.canMutate).toBe(false);
    expect(next.primary.kind).toBe("navigate");
    expect(planHasClaim(next)).toBe(false);
  });
});

describe("no outbound send path", () => {
  it("does not include mark contacted or send actions", () => {
    const next = plan(
      work({ id: "t1", workType: "no_initial_contact", queueSection: "due_today", waitingState: "not_yet_requested" }),
    );
    const labels = [
      next.primary.kind === "inline" ? next.primary.label : next.primary.label,
      ...next.overflow.map((item) => item.label),
    ];
    expect(labels.some((label) => /contacted|send|email|sms/i.test(label))).toBe(false);
  });
});
