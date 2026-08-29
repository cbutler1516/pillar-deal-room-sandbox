import { describe, expect, it } from "vitest";
import { deriveDealNextAction } from "@/lib/ops/next-action";
import type { DecoratedAction } from "@/lib/playbooks/decorate";

function action(partial: Partial<DecoratedAction> = {}): DecoratedAction {
  return {
    id: "task-1",
    dealId: "deal-1",
    title: "Request government-issued ID",
    status: "open",
    priority: "high",
    timing: "required_now",
    taskKind: "request_document",
    sourceType: "borrower",
    instructions: "Request ID.",
    completionRule: null,
    dueAt: null,
    nextFollowUpAt: "2026-08-29T18:00:00.000Z",
    lastContactedAt: null,
    waitingSince: null,
    followUpIntervalHours: 24,
    escalationAfterHours: 48,
    escalationLevel: "none",
    assignedTo: null,
    createdAt: "2026-08-29T12:00:00.000Z",
    playbookKey: "request_government_id",
    clientNeedId: "need-1",
    dealContactId: "c1",
    rank: 1,
    band: "required_now",
    followUpDue: false,
    escalationDue: false,
    overdue: false,
    contactMissing: false,
    waitingAgeHours: null,
    instructionsSummary: "Request ID.",
    borrowerName: "Alex Rivera",
    entityName: "Rivera Holdings LLC",
    dealReference: "PDR-APP-1A606C84",
    propertyAddress: "100 Evaluation Ave",
    contactName: "Alex Rivera",
    contactCompany: null,
    contactEmail: "alex@example.test",
    contactPhone: "555-0100",
    suggestedRequest: "Request a government-issued photo ID.",
    requestText: "Please provide a current government-issued photo ID.",
    ...partial,
  };
}

describe("deterministic next action", () => {
  it("asks for a required replacement first", () => {
    const next = deriveDealNextAction({
      dealId: "deal-1",
      needs: [
        {
          id: "need-1",
          documentType: "Government-issued ID",
          required: true,
          status: "rejected",
        },
      ],
      documents: [],
      nextActions: [action()],
    });
    expect(next?.action).toMatch(/Request replacement Government-issued ID from borrower/);
    expect(next?.target).toBe("needs");
    expect(next?.href).toBe("/deals/deal-1?tab=needs");
  });

  it("follows up with a named third-party contact", () => {
    const next = deriveDealNextAction({
      dealId: "deal-1",
      needs: [
        {
          id: "need-ins",
          documentType: "Insurance Binder",
          required: true,
          status: "requested",
        },
      ],
      documents: [],
      nextActions: [
        action({
          id: "task-ins",
          clientNeedId: "need-ins",
          title: "Request insurance binder",
          sourceType: "insurance",
          contactName: "Jordan Lee",
          followUpDue: true,
        }),
      ],
    });
    expect(next?.action).toMatch(/Follow up with Jordan Lee for insurance binder/i);
    expect(next?.contactName).toBe("Jordan Lee");
    expect(next?.dueAt).toBe("2026-08-29T18:00:00.000Z");
  });

  it("reviews newly received documents", () => {
    const next = deriveDealNextAction({
      dealId: "deal-1",
      needs: [
        {
          id: "need-bank",
          documentType: "Bank Statements",
          required: true,
          status: "received",
        },
      ],
      documents: [
        { id: "doc-1", documentType: "Bank Statements", status: "needs_review" },
      ],
      nextActions: [action({ clientNeedId: "need-bank" })],
    });
    expect(next?.action).toMatch(/Review newly received bank statements/i);
    expect(next?.target).toBe("documents");
  });
});
