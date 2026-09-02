import type { DealStatus } from "@/lib/data/types";
import { DEMO_REFERENCE_PREFIX, demoUuid } from "@/lib/demo/ids";

export type DemoNeed = {
  id: string;
  category: string;
  documentType: string;
  description: string;
  required: boolean;
  status:
    | "missing"
    | "requested"
    | "received"
    | "needs_review"
    | "approved"
    | "rejected"
    | "waived";
  requestedAt: string | null;
  receivedAt: string | null;
  reviewedAt: string | null;
  notes: string | null;
  expectedDocumentCount: number | null;
  requireAllLinkedApproved: boolean;
};

export type DemoDocument = {
  id: string;
  clientNeedIds: string[];
  fileName: string;
  documentType: string;
  storageProvider: "sandbox";
  externalFileId: string;
  mimeType: string;
  status: "received" | "classifying" | "needs_review" | "approved" | "rejected";
  aiClassification: string | null;
  aiConfidence: number | null;
  uploadedAt: string;
};

export type DemoTask = {
  id: string;
  taskType: string;
  title: string;
  description: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting" | "completed" | "dismissed";
  dueAt: string | null;
  sourceType: string | null;
  taskKind: string | null;
  timing: string | null;
  clientNeedId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  followUpIntervalHours: number | null;
  nextFollowUpAt: string | null;
  escalationAfterHours: number | null;
  escalationLevel: string | null;
  completionRule: string | null;
  playbookKey: string | null;
  instructions: string | null;
  lastContactedAt: string | null;
  waitingSince: string | null;
  blockedReason: string | null;
  dealContactId: string | null;
};

export type DemoContact = {
  id: string;
  contactType:
    | "borrower"
    | "co_borrower"
    | "title"
    | "insurance"
    | "escrow"
    | "closing_attorney"
    | "appraiser"
    | "contractor"
    | "property_manager"
    | "cpa"
    | "lender"
    | "realtor"
    | "loan_officer"
    | "other";
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isPrimary: boolean;
};

export type DemoActivity = {
  id: string;
  eventType: string;
  actorType: "system" | "ai" | "service";
  safeMetadata: Record<string, string>;
  createdAt: string;
};

export type DemoDeal = {
  id: string;
  dealReference: string;
  borrowerName: string;
  borrowerEmail: string;
  borrowerPhone: string;
  entityName: string;
  loanType: string;
  loanPurpose: string;
  loanAmount: number;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyType: string;
  creditBand: string;
  experience: string;
  status: DealStatus;
  createdAt: string;
  updatedAt: string;
  needs: DemoNeed[];
  documents: DemoDocument[];
  contacts: DemoContact[];
  tasks: DemoTask[];
  activity: DemoActivity[];
  applicationIntake?: Record<string, unknown> | null;
};

const daysAgo = (days: number, hours = 10) =>
  new Date(Date.UTC(2026, 7, 28 - days, hours, 0, 0)).toISOString();

export const DEMO_DEALS: DemoDeal[] = [
  {
    id: demoUuid(1),
    dealReference: `${DEMO_REFERENCE_PREFIX}001`,
    borrowerName: "Jordan Hale",
    borrowerEmail: "jordan.hale@sandbox.example",
    borrowerPhone: "555-0101",
    entityName: "Hale Value LLC",
    loanType: "Fix & Flip",
    loanPurpose: "Purchase and rehab of a single-family rental conversion",
    loanAmount: 385000,
    propertyAddress: "1842 Cypress Ave",
    propertyCity: "Tampa",
    propertyState: "FL",
    propertyType: "SFR",
    creditBand: "720-739",
    experience: "4 completed flips",
    status: "new",
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1, 12),
    needs: [
      need(101, "Legal", "Purchase Agreement", "missing", true, 1),
      need(102, "Entity", "Entity Documents", "missing", true, 1),
      need(103, "Experience", "Experience Schedule", "requested", true, 1, daysAgo(1)),
      need(104, "Rehab", "Scope of Work", "missing", true, 1),
      need(105, "Rehab", "Rehab Budget", "missing", true, 1),
      need(106, "Liquidity", "Bank Statements", "missing", true, 1),
      need(107, "Insurance", "Insurance", "missing", true, 1),
    ],
    documents: [],
    contacts: [],
    tasks: [
      task(131, "contact_third_party", "Request insurance binder", "Insurance contact is missing.", "normal", "open", daysAgo(-2), {
        playbookKey: "request_insurance_binder",
        sourceType: "insurance",
        taskKind: "contact_third_party",
        timing: "required_now",
        blockedReason: "contact_missing",
        instructions:
          "Contact the insurance agent listed on the deal and request the current binder. Verify the property address and borrower/entity name. Verify lender/mortgagee language if the file requires it. Upload/link the received document to the Insurance request. If no response within 24 hours, follow up. Escalate to the LO after 48 hours. Do not decide coverage adequacy beyond these checks.",
        completionRule:
          "Complete when evidence of coverage is received, linked, and the processor marks it accepted. This is not an insurance-compliance determination.",
      }),
    ],
    activity: [
      activity(401, "deal_created", daysAgo(1), { source: "sandbox_seed" }),
    ],
  },
  {
    id: demoUuid(2),
    dealReference: `${DEMO_REFERENCE_PREFIX}002`,
    borrowerName: "Riley Chen",
    borrowerEmail: "riley.chen@sandbox.example",
    borrowerPhone: "555-0102",
    entityName: "Cypress Nest Holdings",
    loanType: "Fix & Flip",
    loanPurpose: "Light rehab of a vacant bungalow for resale",
    loanAmount: 420000,
    propertyAddress: "77 Birch St",
    propertyCity: "Orlando",
    propertyState: "FL",
    propertyType: "SFR",
    creditBand: "700-719",
    experience: "2 completed flips",
    status: "missing_items",
    createdAt: daysAgo(8),
    updatedAt: daysAgo(1, 15),
    needs: [
      need(201, "Legal", "Purchase Agreement", "received", true, 2, daysAgo(7), daysAgo(3)),
      need(202, "Entity", "Entity Documents", "approved", true, 2, daysAgo(7), daysAgo(5), daysAgo(4)),
      need(203, "Experience", "Experience Schedule", "requested", true, 2, daysAgo(6)),
      need(204, "Rehab", "Scope of Work", "missing", true, 2),
      need(205, "Rehab", "Rehab Budget", "requested", true, 2, daysAgo(5)),
      need(206, "Liquidity", "Bank Statements", "received", true, 2, daysAgo(6), daysAgo(2)),
      need(207, "Insurance", "Insurance", "missing", true, 2),
    ],
    documents: [
      doc(211, 201, "purchase-agreement-77-birch.pdf", "Purchase Agreement", "received", "sandbox-demo-document-001", daysAgo(3), "purchase_agreement", 0.91),
      doc(212, 206, "bank-statements-cypress-nest.pdf", "Bank Statements", "received", "sandbox-demo-document-002", daysAgo(2), "bank_statements", 0.84),
    ],
    contacts: [
      contact(704, "borrower", "Riley Chen", "Cypress Nest Holdings", "riley.chen@sandbox.example", "555-0102", true, "Borrower / sponsor."),
      contact(705, "contractor", "Morgan Price", "Sandbox Renovation Co.", "morgan.price@sandbox-rehab.example", "555-0166", true, "Primary rehab contractor."),
    ],
    tasks: [
      task(221, "request_document", "Request rehab budget", "Line-item rehab budget is still outstanding.", "high", "open", daysAgo(-2), {
        playbookKey: "request_rehab_budget",
        sourceType: "borrower",
        taskKind: "request_document",
        timing: "required_now",
        dealContactId: demoUuid(704),
        clientNeedId: demoUuid(205),
        followUpIntervalHours: 24,
        escalationAfterHours: 48,
        escalationLevel: "none",
        instructions:
          "Request a line-item rehab budget for this Fix & Flip. Confirm it covers the planned work and matches the property. Link it to the Rehab Budget request. Follow up in 24 hours if only a lump sum is sent. Escalate to the LO after 48 hours.",
        completionRule:
          "Complete when a usable budget is received, reviewed, and the Rehab Budget request is approved or explicitly accepted.",
      }),
      task(222, "request_document", "Request scope of work", "Written scope of work is still missing.", "high", "open", daysAgo(-2), {
        playbookKey: "request_scope_of_work",
        sourceType: "borrower",
        taskKind: "request_document",
        timing: "required_now",
        dealContactId: demoUuid(704),
        clientNeedId: demoUuid(204),
        followUpIntervalHours: 24,
        escalationAfterHours: 48,
        escalationLevel: "none",
        instructions:
          "Request a written scope of work describing the rehab. Confirm it is property-specific. Link it to the Scope of Work request. Follow up in 24 hours if it is generic or incomplete. Escalate to the LO after 48 hours.",
        completionRule:
          "Complete when the scope is received, reviewed, and the Scope of Work request is approved or explicitly accepted.",
      }),
      task(223, "follow_up", "Follow up with borrower", "Borrower still owes rehab items.", "high", "waiting", daysAgo(-1), {
        playbookKey: "follow_up_borrower",
        sourceType: "borrower",
        taskKind: "follow_up",
        timing: "required_now",
        dealContactId: demoUuid(704),
        contactName: "Riley Chen",
        contactEmail: "riley.chen@sandbox.example",
        contactPhone: "555-0102",
        followUpIntervalHours: 24,
        nextFollowUpAt: daysAgo(0, 8),
        escalationAfterHours: 48,
        escalationLevel: "none",
        lastContactedAt: daysAgo(1, 12),
        waitingSince: daysAgo(1, 12),
        instructions:
          "Review outstanding borrower requests. Contact the borrower with a specific list of missing items. Record last contacted and schedule the next follow-up. Escalate to the LO after 48 hours without a response.",
        completionRule:
          "Complete when the borrower has responded or the outstanding items are tasked separately. Do not mark the deal complete from this task.",
      }),
    ],
    activity: [
      activity(402, "deal_created", daysAgo(8), { source: "sandbox_seed" }),
      activity(403, "needs_requested", daysAgo(6), { count: "3" }),
    ],
  },
  {
    id: demoUuid(3),
    dealReference: `${DEMO_REFERENCE_PREFIX}003`,
    borrowerName: "Avery Quinn",
    borrowerEmail: "avery.quinn@sandbox.example",
    borrowerPhone: "555-0103",
    entityName: "Quinn Income Partners LLC",
    loanType: "DSCR Purchase",
    loanPurpose: "Purchase of a leased SFR for cash-flow hold",
    loanAmount: 612000,
    propertyAddress: "901 Maple Ridge",
    propertyCity: "Austin",
    propertyState: "TX",
    propertyType: "SFR",
    creditBand: "740-759",
    experience: "6 DSCR rentals",
    status: "processor_review",
    createdAt: daysAgo(5),
    updatedAt: daysAgo(0, 16),
    needs: [
      need(301, "Legal", "Purchase Agreement", "approved", true, 3, daysAgo(5), daysAgo(4), daysAgo(3)),
      need(302, "Income", "Lease / Rent Schedule", "needs_review", true, 3, daysAgo(5), daysAgo(1)),
      need(303, "Insurance", "Insurance", "received", true, 3, daysAgo(4), daysAgo(1)),
      need(304, "Entity", "Entity Documents", "approved", true, 3, daysAgo(5), daysAgo(4), daysAgo(3)),
      need(305, "Liquidity", "Bank Statements / Liquidity", "needs_review", true, 3, daysAgo(4), daysAgo(1), null, null, {
        description: "Most recent 2 months",
        expectedDocumentCount: 2,
      }),
      need(306, "Liquidity", "Proof of Funds", "requested", true, 3, daysAgo(4), null, null, null, {
        description: "May be satisfied by a business bank statement already on file",
      }),
      need(307, "Income", "Pay Stubs", "received", true, 3, daysAgo(4), daysAgo(1), null, null, {
        description: "Most recent 30 days",
        expectedDocumentCount: 3,
      }),
    ],
    documents: [
      doc(311, 302, "lease-901-maple.pdf", "Lease / Rent Schedule", "needs_review", "sandbox-demo-document-003", daysAgo(1), "lease", 0.78),
      doc(312, [305, 306], "july-2026-chase-statement.pdf", "Bank Statements / Liquidity", "approved", "sandbox-demo-document-004", daysAgo(1), "bank_statements", 0.86),
      doc(313, 301, "psa-901-maple.pdf", "Purchase Agreement", "approved", "sandbox-demo-document-005", daysAgo(4), "purchase_agreement", 0.94),
      doc(314, 305, "august-2026-chase-statement.pdf", "Bank Statements / Liquidity", "needs_review", "sandbox-demo-document-013", daysAgo(1), "bank_statements", 0.74),
      doc(315, 307, "paystub-2026-08-01.pdf", "Pay Stubs", "received", "sandbox-demo-document-014", daysAgo(1), "pay_stub", 0.8),
      doc(316, 307, "paystub-2026-08-15.pdf", "Pay Stubs", "received", "sandbox-demo-document-015", daysAgo(1), "pay_stub", 0.82),
      doc(317, 307, "paystub-2026-08-29.pdf", "Pay Stubs", "received", "sandbox-demo-document-016", daysAgo(1), "pay_stub", 0.79),
      doc(318, 304, "articles-quinn-income.pdf", "Entity Documents", "approved", "sandbox-demo-document-017", daysAgo(4), "articles", 0.9),
      doc(319, 304, "operating-agreement-quinn.pdf", "Entity Documents", "approved", "sandbox-demo-document-018", daysAgo(4), "operating_agreement", 0.88),
      doc(320, null, "appraisal-901-maple.pdf", "Appraisal", "received", "sandbox-demo-document-019", daysAgo(1), "appraisal", 0.7),
    ],
    contacts: [
      contact(701, "borrower", "Avery Quinn", "Quinn Income Partners LLC", "avery.quinn@sandbox.example", "555-0103", true, "Borrower / sponsor."),
      contact(702, "insurance", "Jordan Lee", "Hill Country Insurance", "jordan.lee@sandbox-insure.example", "555-0144", true, "Primary insurance agent."),
      contact(703, "title", "Taylor Reed", "Austin Title Sandbox", "taylor.reed@sandbox-title.example", "555-0155", true, "Primary title contact."),
    ],
    tasks: [
      task(321, "contact_third_party", "Request insurance binder", "Need current evidence of coverage from the agent.", "normal", "waiting", daysAgo(-1), {
        playbookKey: "request_insurance_binder",
        sourceType: "insurance",
        taskKind: "contact_third_party",
        timing: "required_now",
        clientNeedId: demoUuid(303),
        dealContactId: demoUuid(702),
        contactName: "Jordan Lee",
        contactEmail: "jordan.lee@sandbox-insure.example",
        contactPhone: "555-0144",
        followUpIntervalHours: 24,
        nextFollowUpAt: daysAgo(0, 9),
        escalationAfterHours: 48,
        escalationLevel: "none",
        lastContactedAt: daysAgo(2, 11),
        waitingSince: daysAgo(2, 11),
        instructions:
          "Contact the insurance agent listed on the deal and request the current binder. Verify the property address and borrower/entity name. Verify lender/mortgagee language if the file requires it. Upload/link the received document to the Insurance request. If no response within 24 hours, follow up. Escalate to the LO after 48 hours. Do not decide coverage adequacy beyond these checks.",
        completionRule:
          "Complete when evidence of coverage is received, linked, and the processor marks it accepted. This is not an insurance-compliance determination.",
      }),
      task(322, "review_document", "Review bank statements", "July is approved; August still needs review.", "normal", "in_progress", daysAgo(-1), {
        playbookKey: "review_bank_statements",
        sourceType: "internal",
        taskKind: "review_document",
        timing: "required_now",
        clientNeedId: demoUuid(305),
        escalationAfterHours: 48,
        escalationLevel: "none",
        instructions:
          "Open the Bank Statements request. Confirm expected months are present, pages are complete, and the account holder matches. If a statement still needs review, leave the need in needs_review. Do not approve the need until the requirement as a whole is satisfied. Escalate to the LO only if the package cannot be interpreted.",
        completionRule:
          "Complete when the processor has reviewed the linked statements. Approval of the request is a separate decision and is never automatic.",
      }),
      task(323, "follow_up", "Follow up on lease / rent schedule", "Lease is in review and may need a borrower correction.", "normal", "waiting", daysAgo(0, 12), {
        playbookKey: "follow_up_lease",
        sourceType: "borrower",
        taskKind: "follow_up",
        timing: "required_now",
        clientNeedId: demoUuid(302),
        dealContactId: demoUuid(701),
        contactName: "Avery Quinn",
        contactEmail: "avery.quinn@sandbox.example",
        contactPhone: "555-0103",
        followUpIntervalHours: 24,
        nextFollowUpAt: daysAgo(1, 12),
        escalationAfterHours: 48,
        escalationLevel: "none",
        lastContactedAt: daysAgo(1, 14),
        waitingSince: daysAgo(1, 14),
        instructions:
          "Check the Lease / Rent Schedule request. If the file is still in review or missing pages, contact the borrower for the correction. Record last contacted and the next follow-up. Escalate to the LO after 48 hours.",
        completionRule:
          "Complete when the lease item is no longer blocked or the processor has a documented borrower response. Do not calculate DSCR.",
      }),
      task(324, "prepare_submission", "Prepare submission when complete", "Do not start until needed-now items are done.", "low", "open", daysAgo(-7), {
        playbookKey: "prepare_submission",
        sourceType: "internal",
        taskKind: "prepare_submission",
        timing: "required_later",
        instructions:
          "Do not start this until needed-now tasks are complete or waived. Walk the Requests list. If anything required is still missing or in review, stop and create or reopen the matching request task. When the file is actually ready, mark this complete. This does not submit to a lender.",
        completionRule:
          "Complete when the processor confirms required-now items are satisfied or waived. This is not an underwriting or credit decision.",
      }),
      task(325, "lender_condition", "Updated insurance binder", "Sandbox lender asked for a current binder after review.", "normal", "waiting", daysAgo(-1), {
        playbookKey: "lender_condition",
        sourceType: "lender",
        taskKind: "request_document",
        timing: "required_now",
        clientNeedId: demoUuid(303),
        contactName: "Jordan Lee",
        followUpIntervalHours: 24,
        nextFollowUpAt: daysAgo(0, 10),
        lastContactedAt: daysAgo(2, 9),
        waitingSince: daysAgo(2, 9),
        instructions: "Source: Sandbox Capital\nDemo condition. Do not send a request automatically.",
      }),
      task(326, "lender_condition", "Current lease", "Sandbox lender asked for the in-force lease.", "normal", "open", daysAgo(-1), {
        playbookKey: "lender_condition",
        sourceType: "lender",
        taskKind: "review_document",
        timing: "required_now",
        clientNeedId: demoUuid(302),
        instructions: "Source: Sandbox Capital\nLease is already in processor review.",
      }),
      task(327, "lender_condition", "Most recent bank statement", "Sandbox lender asked for the latest statement on file.", "normal", "open", daysAgo(-1), {
        playbookKey: "lender_condition",
        sourceType: "lender",
        taskKind: "review_document",
        timing: "required_now",
        clientNeedId: demoUuid(305),
        instructions: "Source: Sandbox Capital\nAugust statement still needs review.",
      }),
    ],
    activity: [
      activity(404, "deal_created", daysAgo(5), { source: "sandbox_seed" }),
      activity(405, "documents_received", daysAgo(1), { count: "2" }),
      activity(328, "task_created", daysAgo(2), {
        kind: "condition",
        title: "Updated insurance binder",
        source: "sandbox_seed",
      }),
      activity(329, "document_metadata_recorded", daysAgo(1), {
        kind: "condition",
        title: "Updated insurance binder",
        source: "sandbox_seed",
      }),
    ],
  },
  {
    id: demoUuid(4),
    dealReference: `${DEMO_REFERENCE_PREFIX}004`,
    borrowerName: "Morgan Ellis",
    borrowerEmail: "morgan.ellis@sandbox.example",
    borrowerPhone: "555-0104",
    entityName: "Ellis Cashflow LLC",
    loanType: "DSCR Refinance",
    loanPurpose: "Rate-and-term refinance of a cash-flowing duplex",
    loanAmount: 540000,
    propertyAddress: "415 Harbor View",
    propertyCity: "Tampa",
    propertyState: "FL",
    propertyType: "Duplex",
    creditBand: "760+",
    experience: "11 DSCR units",
    status: "processor_review",
    createdAt: daysAgo(11),
    updatedAt: daysAgo(2, 14),
    needs: [
      need(401, "Income", "Lease / Rent Schedule", "approved", true, 4, daysAgo(10), daysAgo(8), daysAgo(6)),
      need(402, "Debt", "Mortgage Statement", "needs_review", true, 4, daysAgo(10), daysAgo(3)),
      need(403, "Insurance", "Insurance", "approved", true, 4, daysAgo(9), daysAgo(7), daysAgo(6)),
      need(404, "Entity", "Entity Documents", "approved", true, 4, daysAgo(10), daysAgo(8), daysAgo(7)),
      need(405, "Liquidity", "Bank Statements / Liquidity", "received", true, 4, daysAgo(8), daysAgo(3)),
    ],
    documents: [
      doc(411, 402, "mortgage-statement-ellis.pdf", "Mortgage Statement", "needs_review", "sandbox-demo-document-006", daysAgo(3), "mortgage_statement", 0.81),
      doc(412, 401, "rent-schedule-harbor-view.pdf", "Lease / Rent Schedule", "approved", "sandbox-demo-document-007", daysAgo(8), "rent_schedule", 0.9),
    ],
    contacts: [],
    tasks: [
      task(421, "review_document", "Confirm current mortgage payoff", "Refinance file needs a reviewed mortgage statement.", "normal", "open", daysAgo(-3), {
        sourceType: "internal",
        taskKind: "review_document",
        timing: "required_now",
        clientNeedId: demoUuid(402),
        instructions:
          "Open the Mortgage Statement request. Confirm the property and unpaid balance are visible. Do not calculate a payoff. Leave the need in needs_review until the statement is accepted.",
        completionRule:
          "Complete when the processor has reviewed the statement. This is not a credit decision.",
      }),
    ],
    activity: [
      activity(406, "deal_created", daysAgo(11), { source: "sandbox_seed" }),
      activity(407, "status_changed", daysAgo(4), { to: "processor_review" }),
    ],
  },
  {
    id: demoUuid(5),
    dealReference: `${DEMO_REFERENCE_PREFIX}005`,
    borrowerName: "Casey Brooks",
    borrowerEmail: "casey.brooks@sandbox.example",
    borrowerPhone: "555-0105",
    entityName: "Brooks Multifamily LLC",
    loanType: "Multifamily",
    loanPurpose: "Acquisition of a 12-unit value-add community",
    loanAmount: 1850000,
    propertyAddress: "2200 Oak Terrace",
    propertyCity: "Atlanta",
    propertyState: "GA",
    propertyType: "Multifamily",
    creditBand: "740-759",
    experience: "48 units owned",
    status: "ready_for_submission",
    createdAt: daysAgo(18),
    updatedAt: daysAgo(1, 9),
    needs: [
      need(501, "Income", "Rent Roll", "approved", true, 5, daysAgo(16), daysAgo(12), daysAgo(8)),
      need(502, "Financials", "T12", "approved", true, 5, daysAgo(16), daysAgo(12), daysAgo(8)),
      need(503, "Sponsor", "PFS", "approved", true, 5, daysAgo(15), daysAgo(11), daysAgo(7)),
      need(504, "Sponsor", "Schedule of Real Estate Owned", "approved", true, 5, daysAgo(15), daysAgo(11), daysAgo(7)),
      need(505, "Entity", "Entity Documents", "approved", true, 5, daysAgo(16), daysAgo(13), daysAgo(9)),
      need(506, "Legal", "Purchase Agreement", "approved", true, 5, daysAgo(16), daysAgo(14), daysAgo(10)),
      need(507, "Financials", "Operating Statements", "waived", false, 5, daysAgo(10), null, daysAgo(3), "Covered by T12 for this sandbox file."),
    ],
    applicationIntake: {
      version: 1,
      source: "sandbox_application",
      transaction: "Purchase",
      propertyType: "Multifamily",
      fundingTimeline: "45 days",
      purchasePrice: "2100000",
      requestedLoan: "1850000",
      estimatedArv: "2600000",
      rehabBudget: "250000",
      experience: "48 units owned",
      creditRange: "740-759",
      units: "12",
    },
    documents: [
      doc(511, 501, "rent-roll-oak-terrace.pdf", "Rent Roll", "approved", "sandbox-demo-document-008", daysAgo(12), "rent_roll", 0.93),
      doc(512, 502, "t12-oak-terrace.pdf", "T12", "approved", "sandbox-demo-document-009", daysAgo(12), "t12", 0.88),
      doc(513, 506, "psa-oak-terrace.pdf", "Purchase Agreement", "approved", "sandbox-demo-document-010", daysAgo(14), "purchase_agreement", 0.95),
      doc(514, 505, "brooks-entity-docs.pdf", "Entity Documents", "approved", "sandbox-demo-document-025", daysAgo(13), "entity_docs", 0.91),
      doc(515, 503, "brooks-pfs.pdf", "PFS", "approved", "sandbox-demo-document-026", daysAgo(11), "pfs", 0.86),
    ],
    contacts: [],
    tasks: [
      task(521, "prepare_submission", "Prepare submission package", "All required items approved. Ready for submission review.", "low", "completed", daysAgo(1), {
        playbookKey: "prepare_submission",
        sourceType: "internal",
        taskKind: "prepare_submission",
        timing: "required_later",
        instructions:
          "Walk the Requests list. Required items on this file are approved or waived. Mark complete when the package is assembled. This does not submit to a lender.",
        completionRule:
          "Complete when the processor confirms required-now items are satisfied or waived. This is not an underwriting or credit decision.",
      }),
      task(522, "lender_condition", "Entity documents recertified", "Sandbox lender asked for current entity papers. Cleared.", "low", "completed", daysAgo(2), {
        playbookKey: "lender_condition",
        sourceType: "lender",
        taskKind: "request_document",
        timing: "required_now",
        clientNeedId: demoUuid(505),
        instructions: "Source: Sandbox Capital\nDemo history only. Already cleared.",
      }),
    ],
    activity: [
      activity(408, "deal_created", daysAgo(18), { source: "sandbox_seed" }),
      activity(409, "status_changed", daysAgo(1), { to: "ready_for_submission" }),
      activity(523, "task_created", daysAgo(4), {
        kind: "condition",
        title: "Entity documents recertified",
        source: "sandbox_seed",
      }),
      activity(524, "task_completed", daysAgo(2), {
        kind: "condition",
        title: "Entity documents recertified",
        source: "sandbox_seed",
      }),
    ],
  },
  {
    id: demoUuid(6),
    dealReference: `${DEMO_REFERENCE_PREFIX}006`,
    borrowerName: "Sam Rivera",
    borrowerEmail: "sam.rivera@sandbox.example",
    borrowerPhone: "555-0106",
    entityName: "Rivera Bridge Capital LLC",
    loanType: "Commercial Bridge",
    loanPurpose: "Bridge acquisition of a small industrial bay",
    loanAmount: 975000,
    propertyAddress: "88 Industrial Way",
    propertyCity: "Jacksonville",
    propertyState: "FL",
    propertyType: "Industrial",
    creditBand: "680-699",
    experience: "3 commercial exits",
    status: "processor_review",
    createdAt: daysAgo(14),
    updatedAt: daysAgo(0, 11),
    needs: [
      need(601, "Income", "Rent Roll", "received", true, 6, daysAgo(12), daysAgo(6)),
      need(602, "Financials", "T12", "rejected", true, 6, daysAgo(12), daysAgo(5), daysAgo(1), "Figures do not tie to the operating statements."),
      need(603, "Sponsor", "PFS", "needs_review", true, 6, daysAgo(11), daysAgo(4)),
      need(604, "Sponsor", "Schedule of Real Estate Owned", "requested", true, 6, daysAgo(10)),
      need(605, "Entity", "Entity Documents", "approved", true, 6, daysAgo(13), daysAgo(9), daysAgo(8)),
      need(606, "Legal", "Purchase Agreement", "approved", true, 6, daysAgo(13), daysAgo(10), daysAgo(8)),
      need(607, "Financials", "Operating Statements", "received", true, 6, daysAgo(11), daysAgo(5)),
    ],
    documents: [
      doc(611, 602, "t12-industrial-way.pdf", "T12", "rejected", "sandbox-demo-document-011", daysAgo(5), "t12", 0.41),
      doc(612, 603, "pfs-rivera-bridge.pdf", "PFS", "needs_review", "sandbox-demo-document-012", daysAgo(4), "pfs", 0.66),
    ],
    contacts: [
      contact(706, "title", "Dana Clark", "First Coast Title Sandbox", "dana.clark@sandbox-title.example", "555-0177", true, "Primary title contact."),
      contact(707, "borrower", "Sam Rivera", "Rivera Bridge Capital LLC", "sam.rivera@sandbox.example", "555-0106", true, "Borrower / sponsor."),
    ],
    tasks: [
      task(621, "resolve_exception", "Resolve T12 exception", "Rejected T12 is blocking a clean credit memo.", "urgent", "open", daysAgo(-1), {
        playbookKey: "resolve_exception",
        sourceType: "internal",
        taskKind: "resolve_exception",
        timing: "required_now",
        clientNeedId: demoUuid(602),
        followUpIntervalHours: 12,
        escalationAfterHours: 24,
        escalationLevel: "none",
        blockedReason: "T12 figures do not tie to the operating statements.",
        instructions:
          "Read the exception on the deal. Identify the source (borrower, title, internal). Document the blocked reason. Either collect the replacement item or route the exception to the LO. Do not dismiss an urgent exception without a note.",
        completionRule:
          "Complete when the blocking exception is cleared or explicitly accepted by the processor/LO. No credit conclusion is made.",
      }),
      task(622, "contact_third_party", "Request title contact", "Need a title officer before CPL / prelim can be ordered.", "high", "waiting", daysAgo(-1), {
        playbookKey: "request_preliminary_title_report",
        sourceType: "title",
        taskKind: "contact_third_party",
        timing: "required_later",
        dealContactId: demoUuid(706),
        contactName: "Dana Clark",
        contactEmail: "dana.clark@sandbox-title.example",
        contactPhone: "555-0177",
        followUpIntervalHours: 24,
        nextFollowUpAt: daysAgo(0, 7),
        escalationAfterHours: 48,
        escalationLevel: "loan_officer",
        lastContactedAt: daysAgo(3, 9),
        waitingSince: daysAgo(3, 9),
        instructions:
          "Identify the title contact. Ask title for the preliminary title report. Confirm the legal description matches the deal property. Link the report to the Title request when used. Follow up in 24 hours. Escalate to the LO after 48 hours.",
        completionRule:
          "Complete when the prelim is received, linked if applicable, and the processor marks it accepted.",
      }),
    ],
    activity: [
      activity(410, "deal_created", daysAgo(14), { source: "sandbox_seed" }),
      activity(411, "exception_opened", daysAgo(1), { item: "T12" }),
    ],
  },
  {
    id: demoUuid(7),
    dealReference: `${DEMO_REFERENCE_PREFIX}007`,
    borrowerName: "Casey Nguyen",
    borrowerEmail: "casey.nguyen@sandbox.example",
    borrowerPhone: "555-0107",
    entityName: "Nguyen Flip Holdings LLC",
    loanType: "Fix & Flip",
    loanPurpose: "Purchase and rehab of a vacant bungalow",
    loanAmount: 465000,
    propertyAddress: "612 Willow Court",
    propertyCity: "Tampa",
    propertyState: "FL",
    propertyType: "SFR",
    creditBand: "700-719",
    experience: "3 completed flips",
    status: "collecting_documents",
    createdAt: daysAgo(3),
    updatedAt: daysAgo(0, 14),
    applicationIntake: {
      version: 1,
      source: "sandbox_application",
      transaction: "Purchase",
      propertyType: "SFR",
      fundingTimeline: "30 days",
      purchasePrice: "580000",
      requestedLoan: "465000",
      estimatedArv: "720000",
      rehabBudget: "85000",
      experience: "3 completed flips",
      creditRange: "700-719",
    },
    needs: [
      need(801, "Identity", "Government-issued ID", "rejected", true, 7, daysAgo(3), daysAgo(2), daysAgo(1), "Photo was cropped. Replacement received."),
      need(802, "Liquidity", "Bank Statements", "needs_review", true, 7, daysAgo(3), daysAgo(1), null, null, {
        description: "Most recent 2 months",
        expectedDocumentCount: 2,
      }),
      need(803, "Entity", "Entity Documents", "missing", true, 7),
      need(804, "Insurance", "Insurance", "missing", true, 7),
      need(805, "Legal", "Purchase Agreement", "received", true, 7, daysAgo(3), daysAgo(1)),
      need(806, "Rehab", "Scope of Work", "requested", true, 7, daysAgo(2)),
      need(807, "Liquidity", "Proof of earnest money", "missing", true, 7),
    ],
    documents: [
      doc(811, 801, "casey-nguyen-id-crop.pdf", "Government-issued ID", "rejected", "sandbox-demo-document-020", daysAgo(2), "government_id", 0.42),
      doc(812, 801, "casey-nguyen-id-replacement.pdf", "Government-issued ID", "needs_review", "sandbox-demo-document-021", daysAgo(0, 13), "government_id", 0.71),
      doc(813, 802, "july-2026-nguyen-statement.pdf", "Bank Statements", "needs_review", "sandbox-demo-document-022", daysAgo(1), "bank_statements", 0.8),
      doc(814, 802, "july-2026-nguyen-statement-copy.pdf", "Bank Statements", "received", "sandbox-demo-document-023", daysAgo(1), "bank_statements", 0.77),
      doc(815, 805, "utility-bill-willow-court.pdf", "Utility Bill", "received", "sandbox-demo-document-024", daysAgo(1), "utility_bill", 0.39),
    ],
    contacts: [
      contact(808, "borrower", "Casey Nguyen", "Nguyen Flip Holdings LLC", "casey.nguyen@sandbox.example", "555-0107", true, "Borrower / sponsor. Insurance and title contacts are still missing."),
    ],
    tasks: [
      task(821, "contact_third_party", "Request insurance binder", "Insurance contact is missing.", "high", "open", daysAgo(-1), {
        playbookKey: "request_insurance_binder",
        sourceType: "insurance",
        taskKind: "contact_third_party",
        timing: "required_now",
        clientNeedId: demoUuid(804),
        blockedReason: "contact_missing",
        instructions:
          "Add the insurance contact, then request the current binder. Do not decide coverage adequacy.",
        completionRule:
          "Complete when evidence of coverage is received and the processor marks it accepted.",
      }),
      task(822, "review_document", "Review bank statements", "Two statements are on file, including a likely duplicate.", "normal", "in_progress", daysAgo(-1), {
        playbookKey: "review_bank_statements",
        sourceType: "internal",
        taskKind: "review_document",
        timing: "required_now",
        clientNeedId: demoUuid(802),
        instructions: "Confirm the two files are not the same month. Do not calculate liquidity.",
      }),
      task(823, "lender_condition", "Updated Government-issued ID", "Sandbox lender asked for a readable ID after the cropped photo.", "high", "open", daysAgo(-1), {
        playbookKey: "lender_condition",
        sourceType: "lender",
        taskKind: "review_document",
        timing: "required_now",
        clientNeedId: demoUuid(801),
        instructions: "Source: Sandbox Capital\nReplacement ID is on file and still needs review.",
      }),
      task(824, "lender_condition", "Contractor scope / estimate", "Sandbox lender asked for a written rehab scope.", "normal", "open", daysAgo(-2), {
        playbookKey: "lender_condition",
        sourceType: "lender",
        taskKind: "request_document",
        timing: "required_now",
        clientNeedId: demoUuid(806),
        contactName: "Casey Nguyen",
        followUpIntervalHours: 24,
        nextFollowUpAt: daysAgo(1, 8),
        lastContactedAt: daysAgo(2, 8),
        waitingSince: daysAgo(2, 8),
        instructions: "Source: Sandbox Capital\nDemo condition. Do not send a request automatically.",
      }),
      task(825, "lender_condition", "Proof earnest money deposit", "Sandbox lender asked for cleared earnest money.", "normal", "open", daysAgo(-1), {
        playbookKey: "lender_condition",
        sourceType: "lender",
        taskKind: "request_document",
        timing: "required_now",
        clientNeedId: demoUuid(807),
        followUpIntervalHours: 24,
        nextFollowUpAt: daysAgo(1),
        lastContactedAt: daysAgo(2),
        waitingSince: daysAgo(2),
        instructions: "Source: Sandbox Capital\nStill outstanding. Follow up with the borrower.",
      }),
    ],
    activity: [
      activity(831, "application_received", daysAgo(3), { source: "sandbox_seed" }),
      activity(832, "task_created", daysAgo(2), {
        kind: "condition",
        title: "Updated Government-issued ID",
        source: "sandbox_seed",
      }),
      activity(833, "task_created", daysAgo(2), {
        kind: "condition",
        title: "Contractor scope / estimate",
        source: "sandbox_seed",
      }),
      activity(834, "task_created", daysAgo(2), {
        kind: "condition",
        title: "Proof earnest money deposit",
        source: "sandbox_seed",
      }),
      activity(835, "document_metadata_recorded", daysAgo(0, 13), {
        kind: "condition",
        title: "Updated Government-issued ID",
        source: "sandbox_seed",
      }),
    ],
  },
];

function need(
  id: number,
  category: string,
  documentType: string,
  status: DemoNeed["status"],
  required: boolean,
  _deal: number,
  requestedAt: string | null = null,
  receivedAt: string | null = null,
  reviewedAt: string | null = null,
  notes: string | null = null,
  options?: {
    description?: string;
    expectedDocumentCount?: number | null;
    requireAllLinkedApproved?: boolean;
  },
): DemoNeed {
  return {
    id: demoUuid(id),
    category,
    documentType,
    description: options?.description ?? `${documentType} for sandbox checklist`,
    required,
    status,
    requestedAt,
    receivedAt,
    reviewedAt,
    notes,
    expectedDocumentCount: options?.expectedDocumentCount ?? null,
    requireAllLinkedApproved: options?.requireAllLinkedApproved ?? true,
  };
}

function doc(
  id: number,
  needId: number | number[] | null,
  fileName: string,
  documentType: string,
  status: DemoDocument["status"],
  externalFileId: string,
  uploadedAt: string,
  aiClassification: string | null,
  aiConfidence: number | null,
): DemoDocument {
  const needIds = needId == null ? [] : Array.isArray(needId) ? needId : [needId];
  return {
    id: demoUuid(id),
    clientNeedIds: needIds.map((value) => demoUuid(value)),
    fileName,
    documentType,
    storageProvider: "sandbox",
    externalFileId,
    mimeType: "application/pdf",
    status,
    aiClassification,
    aiConfidence,
    uploadedAt,
  };
}

function task(
  id: number,
  taskType: string,
  title: string,
  description: string,
  priority: DemoTask["priority"],
  status: DemoTask["status"],
  dueAt: string | null,
  extras: Partial<Omit<DemoTask, "id" | "taskType" | "title" | "description" | "priority" | "status" | "dueAt">> = {},
): DemoTask {
  return {
    id: demoUuid(id),
    taskType,
    title,
    description,
    priority,
    status,
    dueAt,
    sourceType: extras.sourceType ?? null,
    taskKind: extras.taskKind ?? null,
    timing: extras.timing ?? null,
    clientNeedId: extras.clientNeedId ?? null,
    contactName: extras.contactName ?? null,
    contactEmail: extras.contactEmail ?? null,
    contactPhone: extras.contactPhone ?? null,
    followUpIntervalHours: extras.followUpIntervalHours ?? null,
    nextFollowUpAt: extras.nextFollowUpAt ?? null,
    escalationAfterHours: extras.escalationAfterHours ?? null,
    escalationLevel: extras.escalationLevel ?? null,
    completionRule: extras.completionRule ?? null,
    playbookKey: extras.playbookKey ?? null,
    instructions: extras.instructions ?? null,
    lastContactedAt: extras.lastContactedAt ?? null,
    waitingSince: extras.waitingSince ?? null,
    blockedReason: extras.blockedReason ?? null,
    dealContactId: extras.dealContactId ?? null,
  };
}

function contact(
  id: number,
  contactType: DemoContact["contactType"],
  name: string,
  company: string | null,
  email: string | null,
  phone: string | null,
  isPrimary: boolean,
  notes: string | null,
): DemoContact {
  return {
    id: demoUuid(id),
    contactType,
    name,
    company,
    email,
    phone,
    notes,
    isPrimary,
  };
}

function activity(
  id: number,
  eventType: string,
  createdAt: string,
  safeMetadata: Record<string, string>,
): DemoActivity {
  return {
    id: demoUuid(id),
    eventType,
    actorType: "system",
    safeMetadata,
    createdAt,
  };
}

export function getDemoReferences(): string[] {
  return DEMO_DEALS.map((deal) => deal.dealReference);
}
