import { describe, expect, it } from "vitest";
import { responseReceivedTaskPatch } from "@/lib/communications/records";
import {
  deriveQueueActionPlan,
  navigationOnlyForWorkType,
  assertNoConditionClearInOffers,
  assertNoDocumentDecisionPath,
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
  isInlineSafeAction,
  NAVIGATION_ONLY_ACTIONS,
} from "@/lib/queue-actions/matrix";
import type { OperationalWorkItem } from "@/lib/ops/operational-work";
import { canClaimDeal, canMutateWorkflow } from "@/lib/ops/workflow";

const NOW = new Date("2026-08-31T18:00:00.000Z");

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
    assignedProcessorId: "proc-chris",
    waitingState: "overdue_response",
    dueAt: "2026-08-29T18:00:00.000Z",
    href: "/deals/deal-1?tab=tasks",
    target: "tasks",
    ...partial,
  };
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
    expect(INLINE_ACTION_SERVER_MAP.set_follow_up.action).toBe(
      "scheduleFollowUpAction",
    );
    expect(INLINE_ACTION_SERVER_MAP.response_received.action).toBe(
      "markResponseReceivedAction",
    );
  });

  it("keeps sensitive workflows navigation-only", () => {
    expect(NAVIGATION_ONLY_ACTIONS).toContain("approve_document");
    expect(NAVIGATION_ONLY_ACTIONS).toContain("clear_condition");
    expect(NAVIGATION_ONLY_ACTIONS).toContain("mark_submitted");
    expect(isInlineSafeAction("approve_document")).toBe(false);
  });
});

describe("claim file", () => {
  it("offers inline claim for unassigned files", () => {
    const plan = deriveQueueActionPlan(
      work({
        id: "u1",
        workType: "unassigned_file",
        queueSection: "new",
        assignedProcessorId: null,
        recommendedAction: "Claim",
        sourceKind: "deal",
        sourceId: "deal-1",
      }),
    );
    expect(plan.primaryInline).toBe("claim_file");
  });

  it("rejects claim when deal already assigned", () => {
    expect(
      canClaimDeal("proc-other", "proc-chris", "processor"),
    ).toBe(false);
    const plan = deriveQueueActionPlan(
      work({
        id: "t1",
        workType: "follow_up_overdue",
        queueSection: "due_today",
        assignedProcessorId: "proc-other",
      }),
    );
    expect(plan.primaryInline).toBeNull();
    expect(plan.secondary.some((item) => item.key === "claim_file")).toBe(false);
  });
});

describe("mark waiting", () => {
  it("offers mark waiting for communication task work", () => {
    const plan = deriveQueueActionPlan(
      work({
        id: "ins-1",
        workType: "follow_up_overdue",
        queueSection: "due_today",
        title: "Insurance binder",
      }),
    );
    expect(plan.secondary.map((item) => item.key)).toContain("mark_waiting");
  });

  it("does not offer mark waiting for document review items", () => {
    const plan = deriveQueueActionPlan(
      work({
        id: "doc-1",
        workType: "document_awaiting_review",
        queueSection: "needs_review",
        sourceKind: "document",
        sourceId: "doc-1",
        recommendedAction: "Review",
      }),
    );
    expect(plan.secondary).toEqual([]);
    expect(navigationOnlyForWorkType("document_awaiting_review")).toBe(true);
  });
});

describe("follow-up presets", () => {
  it("builds LA staff presets with display dates", () => {
    const presets = followUpPresets(NOW);
    expect(presets.map((row) => row.label)).toEqual([
      "Tomorrow",
      "2 days",
      "3 days",
      "1 week",
    ]);
    expect(presets[0]?.displayDate).toMatch(/Sep/);
    expect(staffDatetimeLocalValue(presets[0]!.iso)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("parses custom follow-up without past dates", () => {
    const iso = parseCustomFollowUpInput("2026-09-04T10:00", NOW);
    expect(iso).toBeTruthy();
    expect(formatFollowUpDisplay(iso!)).toMatch(/Sep/);
    expect(parseCustomFollowUpInput("2026-08-01T10:00", NOW)).toBeNull();
  });
});

describe("response received", () => {
  it("offers response received for waiting communication tasks", () => {
    const plan = deriveQueueActionPlan(
      work({
        id: "w1",
        workType: "waiting_on_response",
        queueSection: "waiting",
        waitingState: "contacted_waiting",
      }),
    );
    expect(plan.secondary.map((item) => item.key)).toContain("response_received");
  });

  it("does not auto-complete need or task on response patch", () => {
    const patch = responseReceivedTaskPatch(NOW.toISOString());
    expect(patch.status).toBe("in_progress");
    expect(patch.completed_at).toBeNull();
    expect(patch.last_response_at).toBeTruthy();
  });
});

describe("queue movement and guards", () => {
  it("keeps document decisions navigation-only", () => {
    const plan = deriveQueueActionPlan(
      work({
        id: "r1",
        workType: "replacement_received",
        queueSection: "urgent",
        sourceKind: "need",
        recommendedAction: "Review",
      }),
    );
    expect(assertNoDocumentDecisionPath(plan.primaryInline)).toBe(true);
    expect(plan.secondary).toEqual([]);
  });

  it("never exposes clear condition inline", () => {
    const plan = deriveQueueActionPlan(
      work({
        id: "c1",
        workType: "follow_up_overdue",
        queueSection: "due_today",
        target: "conditions",
        href: "/deals/deal-1?tab=conditions",
      }),
    );
    expect(assertNoConditionClearInOffers(plan.secondary)).toBe(true);
  });

  it("does not expose mark submitted inline on ready work", () => {
    const plan = deriveQueueActionPlan(
      work({
        id: "ready",
        workType: "ready_to_submit",
        queueSection: "due_today",
        sourceKind: "deal",
        recommendedAction: "Prepare submission",
        target: "submission",
      }),
    );
    expect(plan.primaryInline).toBeNull();
    expect(plan.secondary).toEqual([]);
  });
});

describe("authorization", () => {
  it("requires processor/admin workflow mutation rights", () => {
    expect(canMutateWorkflow("processor")).toBe(true);
    expect(canMutateWorkflow("loan_officer")).toBe(false);
  });

  it("disables inline actions when canMutate is false", () => {
    const plan = deriveQueueActionPlan(
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
    expect(plan.canMutate).toBe(false);
  });
});

describe("no outbound send path", () => {
  it("does not include mark contacted inline actions", () => {
    const plan = deriveQueueActionPlan(
      work({ id: "t1", workType: "no_initial_contact", queueSection: "due_today" }),
    );
    expect(
      plan.secondary.some((item) => item.label.toLowerCase().includes("contact")),
    ).toBe(false);
  });
});

describe("filter preservation contract", () => {
  it("relies on server revalidation without client-side queue removal", () => {
    expect(INLINE_ACTION_SERVER_MAP.set_follow_up.fields).toContain("nextFollowUpAt");
  });
});
