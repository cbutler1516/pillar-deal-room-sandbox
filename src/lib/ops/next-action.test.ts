import { describe, expect, it } from "vitest";
import { deriveDealNextAction } from "@/lib/ops/next-action";

const NOW = new Date("2026-08-31T18:00:00.000Z");
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
    lastResponseAt: null,
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
    loanType: "dscr",
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
  it("asks for a required replacement after critical escalation", () => {
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
      now: NOW,
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
          lastContactedAt: "2026-08-30T18:00:00.000Z",
          nextFollowUpAt: "2026-08-31T12:00:00.000Z",
          escalationAfterHours: 72,
          followUpDue: true,
        }),
      ],
      now: NOW,
    });
    expect(next?.action).toMatch(/Follow up with Jordan Lee for insurance binder/i);
    expect(next?.contactName).toBe("Jordan Lee");
    expect(next?.dueAt).toBe("2026-08-31T12:00:00.000Z");
  });

  it("asks to send the initial request when nobody has been contacted", () => {
    const next = deriveDealNextAction({
      dealId: "deal-1",
      needs: [
        {
          id: "need-1",
          documentType: "Government-issued ID",
          required: true,
          status: "requested",
        },
      ],
      documents: [],
      nextActions: [action({ lastContactedAt: null, followUpDue: false })],
      now: NOW,
    });
    expect(next?.action).toMatch(
      /Send initial request to Alex Rivera for government-issued id/i,
    );
  });

  it("orients next action to escalation when the follow-up is overdue", () => {
    const next = deriveDealNextAction({
      dealId: "deal-1",
      needs: [
        {
          id: "need-title",
          documentType: "Title Commitment",
          required: true,
          status: "requested",
        },
      ],
      documents: [],
      nextActions: [
        action({
          id: "task-title",
          clientNeedId: "need-title",
          title: "Request title commitment",
          sourceType: "title",
          contactName: "Taylor Reed",
          lastContactedAt: "2026-08-28T12:00:00.000Z",
          waitingSince: "2026-08-28T12:00:00.000Z",
          escalationLevel: "loan_officer",
          followUpDue: true,
          escalationDue: true,
        }),
      ],
      now: NOW,
    });
    expect(next?.action).toMatch(/Escalate title commitment with Taylor Reed/i);
  });

  it("reviews a recorded response without completing the task", () => {
    const next = deriveDealNextAction({
      dealId: "deal-1",
      needs: [
        {
          id: "need-1",
          documentType: "Government-issued ID",
          required: true,
          status: "requested",
        },
      ],
      documents: [],
      nextActions: [
        action({
          status: "in_progress",
          lastContactedAt: "2026-08-29T12:00:00.000Z",
          lastResponseAt: "2026-08-29T16:00:00.000Z",
          escalationAfterHours: 96,
          followUpDue: false,
        }),
      ],
      now: NOW,
    });
    expect(next?.action).toMatch(/Review response from Alex Rivera/i);
    expect(next?.target).toBe("tasks");
  });

  it("reviews a required document mismatch before overdue follow-up", () => {
    const next = deriveDealNextAction({
      dealId: "deal-1",
      needs: [
        {
          id: "need-id",
          documentType: "Government-issued ID",
          required: true,
          status: "requested",
        },
      ],
      documents: [
        { id: "doc-1", documentType: "Insurance", status: "received" },
      ],
      nextActions: [action({ followUpDue: true })],
      mismatches: [
        {
          documentId: "doc-1",
          needId: "need-id",
          fileName: "insurance-binder.pdf",
          needDocumentType: "Government-issued ID",
        },
      ],
      now: NOW,
    });
    expect(next?.action).toMatch(/mismatched insurance-binder\.pdf/i);
    expect(next?.target).toBe("documents");
  });

  it("collects a missing required document before a normal workflow task", () => {
    const next = deriveDealNextAction({
      dealId: "deal-1",
      needs: [
        {
          id: "need-bank",
          documentType: "Bank Statements",
          required: true,
          status: "missing",
        },
      ],
      documents: [],
      nextActions: [
        action({
          clientNeedId: "need-bank",
          lastContactedAt: "2026-08-29T12:00:00.000Z",
          nextFollowUpAt: "2026-09-04T18:00:00.000Z",
          escalationAfterHours: 96,
        }),
      ],
      now: NOW,
    });
    expect(next?.action).toMatch(/Collect missing required Bank Statements/);
    expect(next?.target).toBe("needs");
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
      now: NOW,
    });
    expect(next?.action).toMatch(/Review newly received bank statements/i);
    expect(next?.target).toBe("documents");
  });
});
