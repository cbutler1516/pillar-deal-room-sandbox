import { describe, expect, it } from "vitest";
import {
  nextDealSortState,
  parseDealSort,
  sortDeals,
  type SortableDeal,
} from "@/lib/ops/deal-sort";
import { filterDeals, type FilterableDeal } from "@/lib/ops/filters";

type Fixture = SortableDeal & FilterableDeal;

const deals: Fixture[] = [
  {
    id: "d-casey",
    dealReference: "PDR-001",
    borrowerName: "Casey Nguyen",
    entityName: "Nguyen Holdings LLC",
    propertyAddress: null,
    propertyCity: "Dallas",
    propertyState: "TX",
    loanAmount: 450_000,
    loanType: "Fix & Flip",
    status: "processor_review",
    assignedProcessorId: "chris",
    ownerName: "Chris Butler",
    nextActionLabel: "Review document",
  },
  {
    id: "d-avery",
    dealReference: "PDR-002",
    borrowerName: "Avery Quinn",
    entityName: "Quinn Income Partners LLC",
    propertyAddress: null,
    propertyCity: "Austin",
    propertyState: "TX",
    loanAmount: 612_000,
    loanType: "DSCR Purchase",
    status: "new",
    assignedProcessorId: "pat",
    ownerName: "Pat Lee",
    nextActionLabel: "Claim file",
  },
  {
    id: "d-jordan",
    dealReference: "PDR-003",
    borrowerName: "Jordan Hale",
    entityName: null,
    propertyAddress: null,
    propertyCity: "Tampa",
    propertyState: "FL",
    loanAmount: null,
    loanType: null,
    status: "collecting_documents",
    assignedProcessorId: null,
    ownerName: null,
    nextActionLabel: null,
  },
  {
    id: "d-blake",
    dealReference: "PDR-004",
    borrowerName: "blake ortiz",
    entityName: "Ortiz Capital",
    propertyAddress: null,
    propertyCity: "Miami",
    propertyState: "FL",
    loanAmount: 275_000,
    loanType: "Bridge",
    status: "ready_for_submission",
    assignedProcessorId: "alex",
    ownerName: "Alex Kim",
    nextActionLabel: "Open submission",
  },
];

function ids(rows: SortableDeal[]): string[] {
  return rows.map((row) => row.id);
}

describe("deal column sorting", () => {
  it("keeps the default Deals ordering when no sort is selected", () => {
    expect(parseDealSort({})).toBeNull();
    expect(parseDealSort({ sort: "loan_amount" })).toBeNull();
    expect(parseDealSort({ sort: "nope", direction: "asc" })).toBeNull();
    expect(parseDealSort({ sort: "loan_amount", direction: "desc" })).toEqual({
      column: "loan_amount",
      direction: "desc",
    });
    const sorted = sortDeals(deals, null);
    expect(sorted).toBe(deals);
    expect(ids(sorted)).toEqual(["d-casey", "d-avery", "d-jordan", "d-blake"]);
  });

  it("sorts loan amount ascending by numeric value", () => {
    const sorted = sortDeals(deals, {
      column: "loan_amount",
      direction: "asc",
    });
    expect(ids(sorted)).toEqual(["d-blake", "d-casey", "d-avery", "d-jordan"]);
    expect(sorted.map((row) => row.loanAmount)).toEqual([
      275_000,
      450_000,
      612_000,
      null,
    ]);
  });

  it("sorts loan amount descending without lexical currency ordering", () => {
    const lexicalTrap: SortableDeal[] = [
      { ...deals[0], id: "a", loanAmount: 90_000 },
      { ...deals[0], id: "b", loanAmount: 1_200_000 },
      { ...deals[0], id: "c", loanAmount: 275_000 },
    ];
    const sorted = sortDeals(lexicalTrap, {
      column: "loan_amount",
      direction: "desc",
    });
    expect(sorted.map((row) => row.loanAmount)).toEqual([
      1_200_000,
      275_000,
      90_000,
    ]);
  });

  it("sorts borrower names case-insensitively ascending", () => {
    const sorted = sortDeals(deals, { column: "borrower", direction: "asc" });
    expect(sorted.map((row) => row.borrowerName)).toEqual([
      "Avery Quinn",
      "blake ortiz",
      "Casey Nguyen",
      "Jordan Hale",
    ]);
  });

  it("sorts borrower names descending", () => {
    const sorted = sortDeals(deals, { column: "borrower", direction: "desc" });
    expect(sorted.map((row) => row.borrowerName)).toEqual([
      "Jordan Hale",
      "Casey Nguyen",
      "blake ortiz",
      "Avery Quinn",
    ]);
  });

  it("places missing loan amounts, owners, types, and next actions after real values", () => {
    const amountDesc = sortDeals(deals, {
      column: "loan_amount",
      direction: "desc",
    });
    expect(amountDesc.at(-1)?.id).toBe("d-jordan");

    const owners = sortDeals(deals, { column: "owner", direction: "asc" });
    expect(owners.at(-1)?.ownerName).toBeNull();
    expect(owners.slice(0, 3).map((row) => row.ownerName)).toEqual([
      "Alex Kim",
      "Chris Butler",
      "Pat Lee",
    ]);

    const types = sortDeals(deals, { column: "loan_type", direction: "desc" });
    expect(types.at(-1)?.loanType).toBeNull();

    const next = sortDeals(deals, { column: "next_action", direction: "asc" });
    expect(next.at(-1)?.nextActionLabel).toBeNull();
  });

  it("cycles none → asc → desc → default ordering", () => {
    const first = nextDealSortState(null, "loan_amount");
    expect(first).toEqual({ column: "loan_amount", direction: "asc" });
    const second = nextDealSortState(first, "loan_amount");
    expect(second).toEqual({ column: "loan_amount", direction: "desc" });
    const third = nextDealSortState(second, "loan_amount");
    expect(third).toBeNull();
    expect(ids(sortDeals(deals, third))).toEqual(ids(deals));
    expect(nextDealSortState(first, "borrower")).toEqual({
      column: "borrower",
      direction: "asc",
    });
  });

  it("sorts the filtered result, not a pre-filter snapshot", () => {
    const filtered = filterDeals(deals, { search: "llc" });
    expect(filtered.map((row) => row.id)).toEqual(["d-casey", "d-avery"]);
    const sorted = sortDeals(filtered, {
      column: "loan_amount",
      direction: "asc",
    });
    expect(ids(sorted)).toEqual(["d-casey", "d-avery"]);
  });

  it("sorts status by displayed label, not raw keys", () => {
    const sorted = sortDeals(deals, { column: "status", direction: "asc" });
    expect(sorted.map((row) => row.status)).toEqual([
      "collecting_documents",
      "processor_review",
      "new",
      "ready_for_submission",
    ]);
  });
});
