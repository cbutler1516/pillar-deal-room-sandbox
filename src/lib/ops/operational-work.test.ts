import { describe, expect, it } from "vitest";
import { deriveDealNextAction } from "@/lib/ops/next-action";
import type { DecoratedAction } from "@/lib/playbooks/decorate";
import {
  collectOperationalWork,
  computeOperationalDashboardCounts,
  countDocumentReviewWork,
  groupOperationalWorkToday,
  hasActionableOperationalWork,
  inferDocumentMismatches,
  waitingCopyForDeal,
  workItemMatchesFilter,
  type OperationalContact,
  type OperationalDeal,
  type OperationalDocument,
  type OperationalNeed,
  type OperationalTask,
} from "@/lib/ops/operational-work";

const NOW = new Date("2026-08-31T18:00:00.000Z");

function deal(partial: Partial<OperationalDeal> = {}): OperationalDeal {
  return {
    id: "deal-casey",
    dealReference: "PDR-APP-3E451176",
    borrowerName: "Casey Nguyen",
    entityName: "Nguyen Flip Holdings LLC",
    loanType: "Fix & Flip",
    status: "new",
    assignedProcessorId: null,
    ...partial,
  };
}

function need(partial: Partial<OperationalNeed> & Pick<OperationalNeed, "id" | "documentType" | "status">): OperationalNeed {
  return {
    dealId: "deal-casey",
    required: true,
    ...partial,
  };
}

function doc(partial: Partial<OperationalDocument> & Pick<OperationalDocument, "id">): OperationalDocument {
  return {
    dealId: "deal-casey",
    status: "needs_review",
    fileName: `${partial.id}.pdf`,
    documentType: null,
    mimeType: "application/pdf",
    linkedNeedIds: [],
    ...partial,
  };
}

function task(partial: Partial<OperationalTask> & Pick<OperationalTask, "id" | "title">): OperationalTask {
  return {
    dealId: "deal-casey",
    status: "open",
    timing: "required_now",
    ...partial,
  };
}

function caseyInput() {
  const casey = deal();
  const needs = [
    need({
      id: "need-id",
      documentType: "Government-issued ID",
      status: "rejected",
    }),
    need({ id: "need-bank", documentType: "Bank Statements", status: "missing" }),
    need({ id: "need-entity", documentType: "Entity Documents", status: "missing" }),
    need({ id: "need-insurance", documentType: "Insurance", status: "missing" }),
    need({ id: "need-title", documentType: "Title Commitment", status: "missing" }),
    need({ id: "need-contractor", documentType: "Scope of Work", status: "missing" }),
  ];
  const documents = [
    doc({
      id: "doc-id-replacement",
      documentType: "Government-issued ID",
      fileName: "casey-id-replacement.pdf",
      linkedNeedIds: ["need-id"],
    }),
    doc({
      id: "doc-bank-1",
      documentType: "Bank Statements",
      fileName: "july-statement.pdf",
    }),
    doc({
      id: "doc-bank-2",
      documentType: "Bank Statements",
      fileName: "july-statement-copy.pdf",
    }),
    doc({
      id: "doc-photo",
      documentType: null,
      fileName: "property-photo.jpg",
      mimeType: "image/jpeg",
    }),
  ];
  const tasks = [
    task({
      id: "task-id",
      title: "Request government-issued ID",
      sourceType: "borrower",
      clientNeedId: "need-id",
    }),
    task({
      id: "task-title",
      title: "Request title commitment",
      sourceType: "title",
      taskKind: "contact_third_party",
      playbookKey: "request_title_commitment",
      blockedReason: "contact_missing",
      clientNeedId: "need-title",
    }),
    task({
      id: "task-ins",
      title: "Request insurance binder",
      sourceType: "insurance",
      taskKind: "contact_third_party",
      playbookKey: "request_insurance_binder",
      blockedReason: "contact_missing",
      clientNeedId: "need-insurance",
    }),
    task({
      id: "task-contractor",
      title: "Request contractor docs",
      sourceType: "contractor",
      taskKind: "contact_third_party",
      blockedReason: "contact_missing",
      clientNeedId: "need-contractor",
    }),
  ];
  const contacts: OperationalContact[] = [
    { id: "c-borrower", dealId: "deal-casey", contactType: "borrower" },
  ];
  return { deals: [casey], needs, documents, tasks, contacts, now: NOW };
}

function averyInput() {
  const avery = deal({
    id: "deal-avery",
    dealReference: "PDR-SBX-003",
    borrowerName: "Avery Quinn",
    entityName: "Quinn Income Partners LLC",
    loanType: "DSCR Purchase",
    status: "processor_review",
    assignedProcessorId: "proc-1",
  });
  const needs = [
    need({
      id: "need-lease",
      dealId: "deal-avery",
      documentType: "Lease / Rent Schedule",
      status: "needs_review",
    }),
    need({
      id: "need-bank",
      dealId: "deal-avery",
      documentType: "Bank Statements",
      status: "needs_review",
    }),
    need({
      id: "need-ins",
      dealId: "deal-avery",
      documentType: "Insurance",
      status: "received",
    }),
  ];
  const documents = [
    doc({
      id: "doc-lease",
      dealId: "deal-avery",
      documentType: "Lease / Rent Schedule",
      fileName: "lease.pdf",
      linkedNeedIds: ["need-lease"],
    }),
    doc({
      id: "doc-bank-1",
      dealId: "deal-avery",
      documentType: "Bank Statements",
      fileName: "july.pdf",
      status: "approved",
      linkedNeedIds: ["need-bank"],
    }),
    doc({
      id: "doc-bank-2",
      dealId: "deal-avery",
      documentType: "Bank Statements",
      fileName: "august.pdf",
      linkedNeedIds: ["need-bank"],
    }),
  ];
  const tasks = [
    task({
      id: "task-ins",
      dealId: "deal-avery",
      title: "Request insurance binder",
      sourceType: "insurance",
      status: "waiting",
      clientNeedId: "need-ins",
      dealContactId: "c-ins",
      contactName: "Jordan Lee",
      lastContactedAt: "2026-08-29T11:00:00.000Z",
      waitingSince: "2026-08-29T11:00:00.000Z",
      nextFollowUpAt: "2026-09-02T09:00:00.000Z",
      followUpIntervalHours: 72,
    }),
    task({
      id: "task-lease",
      dealId: "deal-avery",
      title: "Follow up on lease / rent schedule",
      sourceType: "borrower",
      status: "waiting",
      clientNeedId: "need-lease",
      dealContactId: "c-borrower",
      contactName: "Avery Quinn",
      lastContactedAt: "2026-08-30T14:00:00.000Z",
      waitingSince: "2026-08-30T14:00:00.000Z",
      nextFollowUpAt: "2026-08-31T16:00:00.000Z",
      followUpIntervalHours: 24,
    }),
    task({
      id: "task-bank",
      dealId: "deal-avery",
      title: "Review bank statements",
      sourceType: "internal",
      taskKind: "review_document",
      status: "in_progress",
      clientNeedId: "need-bank",
    }),
  ];
  const contacts: OperationalContact[] = [
    { id: "c-borrower", dealId: "deal-avery", contactType: "borrower" },
    { id: "c-ins", dealId: "deal-avery", contactType: "insurance" },
    { id: "c-title", dealId: "deal-avery", contactType: "title" },
  ];
  return { deals: [avery], needs, documents, tasks, contacts, now: NOW };
}

function decorated(partial: Partial<DecoratedAction> = {}): DecoratedAction {
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
    assignedTo: "proc-1",
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

describe("Casey evaluation file", () => {
  it("never produces an empty queue while replacement, reviews, and contacts are open", () => {
    const items = collectOperationalWork(caseyInput());
    expect(hasActionableOperationalWork(items)).toBe(true);
    expect(items.some((row) => row.workType === "replacement_received")).toBe(true);
    expect(items.some((row) => row.workType === "required_contact_missing")).toBe(true);
    expect(items.some((row) => row.workType === "document_awaiting_review" || row.workType === "document_duplicate")).toBe(true);
    expect(items.some((row) => row.workType === "new_application")).toBe(true);
    expect(items.some((row) => /photo/i.test(row.title) || /photo/i.test(row.reason))).toBe(false);

    const grouped = groupOperationalWorkToday(items);
    const visible = [
      ...grouped.urgent,
      ...grouped.due_today,
      ...grouped.needs_review,
      ...grouped.waiting,
      ...grouped.new,
    ];
    expect(visible.length).toBeGreaterThan(0);
    expect(grouped.urgent.some((row) => row.workType === "replacement_received")).toBe(true);
    expect(grouped.due_today.some((row) => row.workType === "required_contact_missing")).toBe(true);
  });

  it("ranks replacement and missing contacts above an empty-state outcome", () => {
    const next = deriveDealNextAction({
      dealId: "deal-casey",
      needs: caseyInput().needs.map((row) => ({
        id: row.id,
        documentType: row.documentType ?? row.id,
        required: row.required,
        status: row.status,
      })),
      documents: caseyInput().documents.map((row) => ({
        id: row.id,
        documentType: row.documentType ?? null,
        status: row.status,
        fileName: row.fileName,
        mimeType: row.mimeType,
        linkedNeedIds: row.linkedNeedIds,
      })),
      nextActions: caseyInput().tasks.map((row) =>
        decorated({
          id: row.id,
          dealId: row.dealId,
          title: row.title,
          sourceType: row.sourceType ?? null,
          clientNeedId: row.clientNeedId,
          blockedReason: row.blockedReason,
          dealContactId: row.dealContactId ?? null,
          contactName: row.contactName ?? null,
          borrowerName: "Casey Nguyen",
          loanType: "Fix & Flip",
        }),
      ),
      deal: caseyInput().deals[0],
      now: NOW,
    });
    expect(next?.action).toMatch(/replacement/i);
    expect(next?.target).toBe("documents");
  });

  it("counts received replacement and bank docs as review work, not only needs_review status", () => {
    const input = caseyInput();
    const items = collectOperationalWork({
      ...input,
      documents: input.documents.map((row) =>
        row.id === "doc-photo" ? row : { ...row, status: "received" },
      ),
    });
    expect(countDocumentReviewWork(items)).toBeGreaterThan(0);
    expect(items.some((row) => row.workType === "replacement_received")).toBe(true);
    expect(
      items.some(
        (row) =>
          row.workType === "document_awaiting_review" ||
          row.workType === "document_duplicate",
      ),
    ).toBe(true);
  });
});

describe("Avery evaluation file", () => {
  it("surfaces bank-statement review, lease follow-up, and insurance waiting", () => {
    const items = collectOperationalWork(averyInput());
    expect(items.some((row) => row.workType === "document_awaiting_review" && /bank/i.test(row.title))).toBe(true);
    expect(
      items.some(
        (row) =>
          /lease/i.test(row.title) &&
          (row.workType === "follow_up_due_today" ||
            row.workType === "document_awaiting_review" ||
            row.workType === "follow_up_overdue"),
      ),
    ).toBe(true);
    expect(
      items.some(
        (row) =>
          /insurance/i.test(row.title) &&
          (row.queueSection === "waiting" ||
            row.workType === "waiting_on_response" ||
            row.workType === "waiting_beyond_cadence" ||
            row.workType === "follow_up_due_today" ||
            row.workType === "follow_up_overdue"),
      ),
    ).toBe(true);
    expect(items.some((row) => row.workType === "required_contact_missing")).toBe(false);
  });
});

describe("dashboard and queue reconciliation", () => {
  it("makes Docs to review and Needs attention discoverable as the same work items", () => {
    const items = collectOperationalWork({
      ...caseyInput(),
      deals: [...caseyInput().deals, ...averyInput().deals],
      needs: [...caseyInput().needs, ...averyInput().needs],
      documents: [...caseyInput().documents, ...averyInput().documents],
      tasks: [...caseyInput().tasks, ...averyInput().tasks],
      contacts: [...caseyInput().contacts, ...averyInput().contacts],
    });
    const counts = computeOperationalDashboardCounts(items);
    expect(counts.docsToReview).toBe(counts.reviewItemIds.length);
    expect(counts.reviewItemIds.every((id) => items.some((row) => row.id === id))).toBe(true);
    expect(
      counts.reviewItemIds.every((id) => {
        const row = items.find((item) => item.id === id);
        return row ? workItemMatchesFilter(row, "review") : false;
      }),
    ).toBe(true);
    expect(counts.needsAttention).toBe(counts.attentionDealIds.length);
    expect(counts.needsAttention).toBeGreaterThan(0);
    expect(counts.waiting).toBe(counts.waitingItemIds.length);
    expect(
      counts.waitingItemIds.every((id) => items.some((row) => row.id === id && row.queueSection === "waiting")),
    ).toBe(true);
  });

  it("does not treat an unlinked photo as a document mismatch", () => {
    const mismatches = inferDocumentMismatches(
      [need({ id: "need-id", documentType: "Government-issued ID", status: "rejected" })],
      [
        doc({
          id: "doc-photo",
          fileName: "porch.jpg",
          mimeType: "image/jpeg",
          documentType: null,
        }),
      ],
    );
    expect(mismatches).toEqual([]);
  });
});

describe("lender condition work", () => {
  it("remaps lender-task work to Conditions without changing rank", () => {
    const items = collectOperationalWork({
      deals: [deal({ status: "collecting_documents" })],
      needs: [
        need({
          id: "need-earnest",
          documentType: "Proof of earnest money",
          status: "missing",
        }),
      ],
      documents: [],
      tasks: [
        task({
          id: "task-condition",
          title: "Proof earnest money deposit",
          sourceType: "lender",
          playbookKey: "lender_condition",
          taskKind: "request_document",
          status: "open",
          lastContactedAt: "2026-08-29T10:00:00.000Z",
          nextFollowUpAt: "2026-08-30T10:00:00.000Z",
          followUpIntervalHours: 24,
          clientNeedId: "need-earnest",
        }),
      ],
      now: NOW,
    });
    const conditionWork = items.filter((row) => row.sourceId === "task-condition");
    expect(conditionWork.length).toBeGreaterThan(0);
    expect(conditionWork.every((row) => row.target === "conditions")).toBe(true);
    expect(conditionWork.every((row) => row.href.includes("tab=conditions"))).toBe(
      true,
    );
    expect(conditionWork.some((row) => row.reason === "Condition still outstanding")).toBe(
      true,
    );
    expect(conditionWork.some((row) => row.recommendedAction === "Follow up")).toBe(true);
    const overdue = conditionWork.find((row) => row.workType === "follow_up_overdue");
    expect(overdue?.priorityRank).toBe(5);
    expect(overdue?.queueSection).toBe("due_today");
  });
});

describe("submission queue destinations", () => {
  it("sends ready files to the Submission workspace", () => {
    const items = collectOperationalWork({
      deals: [
        deal({
          status: "ready_for_submission",
          assignedProcessorId: "proc-1",
        }),
      ],
      needs: [
        need({
          id: "need-id",
          documentType: "Government-issued ID",
          status: "approved",
        }),
      ],
      documents: [],
      tasks: [],
      now: NOW,
    });
    const ready = items.filter((row) => row.workType === "ready_to_submit");
    expect(ready).toHaveLength(1);
    expect(ready[0]?.href).toContain("tab=submission");
    expect(ready[0]?.recommendedAction).toBe("Prepare submission");
    expect(ready[0]?.target).toBe("submission");
  });

  it("keeps condition work after submit and drops prepare-submission work", () => {
    const items = collectOperationalWork({
      deals: [deal({ status: "submitted", assignedProcessorId: "proc-1" })],
      needs: [
        need({
          id: "need-earnest",
          documentType: "Proof of earnest money",
          status: "missing",
        }),
      ],
      documents: [],
      tasks: [
        task({
          id: "task-condition",
          title: "Proof earnest money deposit",
          sourceType: "lender",
          playbookKey: "lender_condition",
          taskKind: "request_document",
          status: "open",
          lastContactedAt: "2026-08-29T10:00:00.000Z",
          nextFollowUpAt: "2026-08-30T10:00:00.000Z",
          followUpIntervalHours: 24,
          clientNeedId: "need-earnest",
        }),
      ],
      now: NOW,
    });
    expect(items.some((row) => row.workType === "ready_to_submit")).toBe(false);
    expect(items.some((row) => row.workType === "unassigned_file")).toBe(false);
    expect(items.some((row) => row.sourceId === "task-condition")).toBe(true);
  });
});

describe("waiting language", () => {
  it("says no request was sent instead of waiting on nobody", () => {
    const items = collectOperationalWork(caseyInput());
    const copy = waitingCopyForDeal(items.filter((row) => row.dealId === "deal-casey"));
    expect(copy.empty).toBe("No request has been sent yet.");
    expect(copy.labels).toEqual([]);
  });

  it("names the person when a request is actually outstanding", () => {
    const items = collectOperationalWork(averyInput());
    const copy = waitingCopyForDeal(items.filter((row) => row.queueSection === "waiting"));
    expect(copy.labels.join(" ")).toMatch(/Jordan Lee/i);
  });
});
