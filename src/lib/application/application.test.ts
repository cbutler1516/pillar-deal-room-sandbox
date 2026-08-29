import { describe, expect, it } from "vitest";
import { applicationFieldVisibility } from "@/lib/application/fields";
import {
  APPLICATION_REFERENCE_PREFIX,
  buildApplicationPackage,
  intakeMetadataFromDraft,
  playbookKeysForApplication,
} from "@/lib/application/package";
import { createPortalToken, readPortalToken } from "@/lib/application/token";
import { emptyApplicationDraft, type ApplicationDraft } from "@/lib/application/types";
import { validateApplication } from "@/lib/application/validate";
import { CONTACT_MISSING } from "@/lib/contacts/types";
import { computeDashboardCounts } from "@/lib/ops/metrics";

function draft(overrides: Partial<ApplicationDraft> = {}): ApplicationDraft {
  return {
    ...emptyApplicationDraft(),
    loanType: "Fix & Flip",
    transactionType: "purchase",
    firstName: "Test",
    lastName: "Borrower",
    email: "test.borrower@example.test",
    phone: "555-0100",
    propertyAddress: "100 Evaluation Ave",
    propertyCity: "Austin",
    propertyState: "TX",
    propertyZip: "78701",
    loanAmount: "450000",
    ...overrides,
  };
}

describe("application field visibility", () => {
  it("shows flip fields and hides commercial NOI", () => {
    const visibility = applicationFieldVisibility("Fix & Flip", "purchase");
    expect(visibility.estimatedArv).toBe(true);
    expect(visibility.rehabBudget).toBe(true);
    expect(visibility.purchasePrice).toBe(true);
    expect(visibility.noi).toBe(false);
  });

  it("shows DSCR purchase rent fields and not refinance payoff", () => {
    const visibility = applicationFieldVisibility("DSCR Purchase", "purchase");
    expect(visibility.monthlyRent).toBe(true);
    expect(visibility.units).toBe(true);
    expect(visibility.existingPayoff).toBe(false);
    expect(visibility.cashOutAmount).toBe(false);
  });

  it("shows DSCR refinance payoff and cash-out", () => {
    const visibility = applicationFieldVisibility("DSCR Refinance", "cash-out refinance");
    expect(visibility.currentValue).toBe(true);
    expect(visibility.existingPayoff).toBe(true);
    expect(visibility.cashOutAmount).toBe(true);
    expect(visibility.monthlyRent).toBe(true);
  });

  it("shows construction land and permit fields", () => {
    const visibility = applicationFieldVisibility("Ground-Up Construction", "construction");
    expect(visibility.landOwned).toBe(true);
    expect(visibility.constructionBudget).toBe(true);
    expect(visibility.plansPermitsStatus).toBe(true);
    expect(visibility.monthlyRent).toBe(false);
  });

  it("shows commercial occupancy and NOI", () => {
    const visibility = applicationFieldVisibility("Commercial", "purchase");
    expect(visibility.occupancy).toBe(true);
    expect(visibility.noi).toBe(true);
    expect(visibility.squareFootage).toBe(true);
    expect(visibility.netWorth).toBe(true);
  });
});

describe("application validation", () => {
  it("requires borrower and property identity fields", () => {
    const result = validateApplication(emptyApplicationDraft());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/loan type/i);
    }
  });

  it("rejects an invalid email", () => {
    const result = validateApplication(draft({ email: "not-an-email" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/valid email/i);
    }
  });

  it("accepts a complete evaluation draft", () => {
    const result = validateApplication(draft());
    expect(result.ok).toBe(true);
  });
});

describe("application package", () => {
  it("creates a deal, borrower contact, requested needs, tasks, and activity", () => {
    const pack = buildApplicationPackage(
      draft({
        estimatedArv: "620000",
        rehabBudget: "80000",
        purchasePrice: "400000",
        loanOfficerNotes: "Internal evaluation note",
      }),
    );

    expect(pack.dealReference.startsWith(APPLICATION_REFERENCE_PREFIX)).toBe(true);
    expect(pack.deal.status).toBe("new");
    expect(pack.deal.borrower_name).toBe("Test Borrower");
    expect(pack.deal.loan_amount).toBe(450000);
    expect(pack.contact.contact_type).toBe("borrower");
    expect(pack.contact.is_primary).toBe(true);
    expect(pack.needs.length).toBeGreaterThan(3);
    expect(pack.needs.every((need) => need.status === "requested")).toBe(true);
    expect(pack.tasks.length).toBeGreaterThan(pack.needs.length);
    expect(pack.activity.event_type).toBe("application_received");
    expect(pack.activity.safe_metadata).toMatchObject({
      source: "sandbox_application",
      estimated_arv: "620000",
      loan_officer_notes: "Internal evaluation note",
    });
    expect(pack.deal.application_intake).toMatchObject({
      source: "sandbox_application",
      estimatedArv: "620000",
      rehabBudget: "80000",
      purchasePrice: "400000",
      requestedLoan: "450000",
    });
    const bankNeed = pack.needs.find(
      (need) => need.document_type === "Bank Statements",
    );
    expect(bankNeed?.expected_document_count).toBe(2);
  });

  it("blocks third-party tasks until a matching contact exists", () => {
    const pack = buildApplicationPackage(draft());
    const titleTask = pack.tasks.find(
      (task) => task.playbook_key === "request_preliminary_title_report",
    );
    expect(titleTask).toBeDefined();
    expect(titleTask?.blocked_reason).toBe(CONTACT_MISSING);
    expect(titleTask?.deal_contact_id).toBeNull();
  });

  it("adds purchase and refinance extras without duplicating baseline keys", () => {
    const purchase = playbookKeysForApplication(draft());
    expect(purchase.filter((key) => key === "request_purchase_agreement")).toEqual([
      "request_purchase_agreement",
    ]);
    const refi = playbookKeysForApplication(
      draft({ loanType: "DSCR Refinance", transactionType: "refinance" }),
    );
    expect(refi).toContain("request_mortgage_statement");
    expect(refi.filter((key) => key === "request_mortgage_statement")).toHaveLength(1);
  });

  it("keeps intake metadata string-only and truncated", () => {
    const metadata = intakeMetadataFromDraft(
      draft({ borrowerComments: `${"x".repeat(200)}` }),
    );
    expect(metadata.borrower_comments).toHaveLength(120);
    expect(Object.values(metadata).every((value) => typeof value === "string")).toBe(
      true,
    );
  });
});

describe("portal token", () => {
  it("round-trips a deal id and rejects a tampered token", () => {
    const dealId = "11111111-2222-3333-4444-555555555555";
    const token = createPortalToken(dealId);
    expect(readPortalToken(token)).toBe(dealId);
    expect(readPortalToken(`${dealId}.not-a-signature`)).toBeNull();
    expect(readPortalToken("not-a-token")).toBeNull();
  });
});

describe("dashboard integration", () => {
  it("counts an application-created deal as a new deal", () => {
    const pack = buildApplicationPackage(draft());
    const counts = computeDashboardCounts(
      [
        {
          id: pack.dealId,
          status: "new",
          assignedProcessorId: null,
          createdAt: String(pack.deal.created_at),
        },
      ],
      [],
      [],
      [],
    );
    expect(counts.newDeals).toBe(1);
    expect(counts.readyForSubmission).toBe(0);
  });
});
