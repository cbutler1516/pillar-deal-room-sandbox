import { describe, expect, it } from "vitest";
import { filterDeals, parseDealFilters } from "@/lib/ops/filters";

const deals = [
  {
    dealReference: "PDR-SBX-001",
    borrowerName: "Jordan Hale",
    entityName: "Hale Value LLC",
    propertyAddress: "1842 Cypress Ave",
    propertyCity: "Tampa",
    propertyState: "FL",
    loanType: "Fix & Flip",
    status: "new" as const,
    assignedProcessorId: null,
  },
  {
    dealReference: "PDR-SBX-003",
    borrowerName: "Avery Quinn",
    entityName: "Quinn Income Partners LLC",
    propertyAddress: "901 Maple Ridge",
    propertyCity: "Austin",
    propertyState: "TX",
    loanType: "DSCR Purchase",
    status: "processor_review" as const,
    assignedProcessorId: "proc-1",
  },
];

describe("deal filtering", () => {
  it("parses search params safely", () => {
    expect(
      parseDealFilters({
        q: "tampa",
        status: "new",
        assignment: "unassigned",
      }),
    ).toMatchObject({
      search: "tampa",
      status: "new",
      assignment: "unassigned",
    });
  });

  it("searches borrower, entity, reference, and property", () => {
    expect(filterDeals(deals, { search: "hale" })).toHaveLength(1);
    expect(filterDeals(deals, { search: "PDR-SBX-003" })).toHaveLength(1);
    expect(filterDeals(deals, { search: "maple" })).toHaveLength(1);
    expect(filterDeals(deals, { search: "nope" })).toHaveLength(0);
  });

  it("filters status, loan type, and assignment", () => {
    expect(filterDeals(deals, { status: "new" })).toHaveLength(1);
    expect(filterDeals(deals, { loanType: "DSCR Purchase" })).toHaveLength(1);
    expect(filterDeals(deals, { assignment: "unassigned" })).toHaveLength(1);
    expect(filterDeals(deals, { assignment: "assigned" })).toHaveLength(1);
  });
});
