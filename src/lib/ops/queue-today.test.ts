import { describe, expect, it } from "vitest";
import {
  queuePrimaryAction,
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

describe("queue row language", () => {
  const now = new Date("2026-08-31T18:00:00.000Z");

  it("keeps ranking hidden and answers who / what / why / do", () => {
    const overdue = action({
      followUpDue: true,
      waitingAgeHours: 26,
      band: "follow_up_due",
      lastContactedAt: "2026-08-30T12:00:00.000Z",
    });
    expect(queueWhyNow(overdue, now)).toBe("Follow-up overdue by 1 day");
    expect(queuePrimaryAction(overdue).label).toBe("Follow up");
  });

  it("does not call an unsent request waiting", () => {
    expect(queueWhyNow(action({ status: "waiting", lastContactedAt: null }), now)).toBe(
      "No request has been sent yet",
    );
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
        lastContactedAt: "2026-08-30T12:00:00.000Z",
      }),
    ).toBe("Follow up");
  });
});
