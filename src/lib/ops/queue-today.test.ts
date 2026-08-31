import { describe, expect, it } from "vitest";
import {
  groupQueueToday,
  queuePrimaryAction,
  queueTodaySection,
  queueWhyNow,
  taskPrimaryActionLabel,
} from "@/lib/ops/queue-today";
import type { DecoratedAction } from "@/lib/playbooks/decorate";

function action(overrides: Partial<DecoratedAction> = {}): DecoratedAction {
  return {
    id: "t1",
    dealId: "d1",
    title: "Insurance Binder",
    status: "open",
    priority: "normal",
    timing: "required_now",
    taskKind: "request",
    sourceType: "insurance",
    instructions: null,
    completionRule: null,
    dueAt: null,
    nextFollowUpAt: null,
    lastContactedAt: null,
    lastResponseAt: null,
    waitingSince: null,
    followUpIntervalHours: 24,
    escalationAfterHours: 72,
    escalationLevel: null,
    assignedTo: null,
    createdAt: "2026-08-31T10:00:00.000Z",
    playbookKey: null,
    clientNeedId: null,
    dealContactId: null,
    blockedReason: null,
    rank: 1,
    band: "required_now",
    followUpDue: false,
    escalationDue: false,
    overdue: false,
    contactMissing: false,
    waitingAgeHours: null,
    instructionsSummary: "",
    borrowerName: "Alex Rivera",
    entityName: null,
    dealReference: "PDR-1",
    loanType: "DSCR",
    propertyAddress: null,
    contactName: "Alex Rivera",
    contactCompany: null,
    contactEmail: null,
    contactPhone: null,
    suggestedRequest: "Request the binder",
    requestText: "",
    ...overrides,
  };
}

describe("queue today sections", () => {
  const now = new Date("2026-08-31T18:00:00.000Z");

  it("keeps ranking hidden and answers who / what / why / do", () => {
    const overdue = action({
      followUpDue: true,
      waitingAgeHours: 26,
      band: "follow_up_due",
    });
    expect(queueTodaySection(overdue, now)).toBe("due_today");
    expect(queueWhyNow(overdue, now)).toBe("Follow-up overdue by 1 day");
    expect(queuePrimaryAction(overdue).label).toBe("Follow up");
  });

  it("puts escalations in Urgent and responses in Ready to review", () => {
    const urgent = action({
      escalationDue: true,
      band: "overdue_or_escalation",
    });
    const review = action({
      lastResponseAt: "2026-08-31T16:00:00.000Z",
      band: "document_review",
    });
    const grouped = groupQueueToday([urgent, review], now);
    expect(grouped.urgent).toHaveLength(1);
    expect(grouped.ready_to_review).toHaveLength(1);
    expect(queuePrimaryAction(review).label).toBe("Review");
  });

  it("picks one primary task action from state", () => {
    expect(
      taskPrimaryActionLabel({
        contactMissing: true,
        followUpDue: true,
        escalationDue: false,
        status: "open",
      }),
    ).toBe("Contact");
    expect(
      taskPrimaryActionLabel({
        contactMissing: false,
        followUpDue: true,
        escalationDue: false,
        status: "waiting",
      }),
    ).toBe("Follow up");
  });
});
