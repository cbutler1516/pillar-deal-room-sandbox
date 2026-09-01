import { describe, expect, it } from "vitest";
import {
  buildSubmissionEmail,
  isCopySafeSubmissionText,
  polishSubmissionEmail,
} from "@/lib/submission/email";
import { buildDealSummary } from "@/lib/submission/summary";

const summary = buildDealSummary({
  borrowerName: "Casey Brooks",
  entityName: "Brooks Multifamily LLC",
  loanType: "Multifamily",
  loanPurpose: "Acquisition of a 12-unit value-add community",
  loanAmount: 1850000,
  propertyAddress: "2200 Oak Terrace",
  propertyCity: "Atlanta",
  propertyState: "GA",
  propertyType: "Multifamily",
  experience: "48 units owned",
  creditBand: "740-759",
  intake: {
    version: 1,
    source: "sandbox_application",
    transaction: "purchase",
    purchasePrice: "2100000",
    rehabBudget: "250000",
    estimatedArv: "2600000",
    fundingTimeline: "45 days",
  },
});

describe("submission email", () => {
  it("builds a copy-only lender draft from stored facts", () => {
    const email = buildSubmissionEmail({
      borrowerName: "Casey Brooks",
      loanType: "Multifamily",
      propertyAddress: "2200 Oak Terrace",
      propertyCity: "Atlanta",
      propertyState: "GA",
      sections: summary.sections,
      manifest: [
        {
          id: "1",
          fileName: "rent-roll.pdf",
          documentType: "Rent Roll",
          needLabels: ["Rent Roll"],
          status: "Approved",
          uploadedAt: "2026-08-01T00:00:00.000Z",
          reviewStatus: "Reviewed",
        },
      ],
    });
    expect(email.subject).toBe(
      "Multifamily Submission — Casey Brooks — 2200 Oak Terrace, Atlanta, GA",
    );
    expect(email.body).toContain("Pillar Private Lending");
    expect(email.body).toContain("Requested Loan: $1,850,000");
    expect(email.body).toContain("rent-roll.pdf");
    expect(email.body).not.toMatch(/approved|qualified|eligible|interest rate/i);
    expect(email.body).not.toMatch(/555-|@sandbox|portal|token|password/i);
    expect(isCopySafeSubmissionText(email.body)).toBe(true);
  });

  it("renders Not provided instead of guessing", () => {
    const empty = buildDealSummary({
      borrowerName: "Casey Nguyen",
      entityName: null,
      loanType: null,
      loanPurpose: null,
      loanAmount: null,
      propertyAddress: null,
      propertyCity: null,
      propertyState: null,
      propertyType: null,
      experience: null,
      creditBand: null,
    });
    expect(empty.sections.flatMap((section) => section.fields).some((field) => field.value === "Not provided")).toBe(
      true,
    );
    const email = buildSubmissionEmail({
      borrowerName: "Casey Nguyen",
      loanType: null,
      propertyAddress: null,
      propertyCity: null,
      propertyState: null,
      sections: empty.sections,
      manifest: [],
    });
    expect(email.body).toContain("Not provided");
    expect(email.body).toContain("No approved, linked documents");
  });

  it("labels a rewrite as a suggestion and strips forbidden claims", () => {
    const polished = polishSubmissionEmail(
      "This file is approved at 8.5% and we will send it.",
    );
    expect(polished.suggestion).toBe(true);
    expect(polished.body).toMatch(/Suggestion only/);
    expect(polished.body).not.toMatch(/approved|8\.5%/i);
    expect(polished.body).not.toMatch(/will send/i);
  });
});
