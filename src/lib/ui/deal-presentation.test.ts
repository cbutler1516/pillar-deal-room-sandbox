import { describe, expect, it } from "vitest";
import {
  countRequiredItemsReceived,
  dealProgressIndex,
  dealProgressState,
  dealSnapshotMetrics,
  formatCompactMoney,
  nextActionPresentation,
  parsePositiveMoney,
} from "@/lib/ui/deal-presentation";

describe("deal presentation", () => {
  it("maps deal status to the four safe progress stages", () => {
    expect(dealProgressIndex("new")).toBe(0);
    expect(dealProgressIndex("collecting_documents")).toBe(1);
    expect(dealProgressIndex("processor_review")).toBe(2);
    expect(dealProgressIndex("ready_for_submission")).toBe(3);
    expect(dealProgressState("new", 0)).toBe("current");
    expect(dealProgressState("processor_review", 0)).toBe("complete");
    expect(dealProgressState("processor_review", 3)).toBe("future");
  });

  it("counts required items received without calling them complete", () => {
    expect(
      countRequiredItemsReceived([
        { required: true, status: "requested" },
        { required: true, status: "received" },
        { required: true, status: "needs_review" },
        { required: true, status: "approved" },
        { required: false, status: "received" },
      ]),
    ).toEqual({ received: 3, required: 4 });
  });

  it("omits zero, empty, and invented snapshot values", () => {
    expect(parsePositiveMoney(0)).toBeNull();
    expect(parsePositiveMoney("0")).toBeNull();
    expect(parsePositiveMoney("$250,000")).toBe(250000);
    expect(formatCompactMoney(200000)).toBe("$200K");
    expect(
      dealSnapshotMetrics({
        loanType: "DSCR Purchase",
        loanAmount: 612000,
        intake: {
          source: "sandbox_application",
          currentValue: "750000",
          monthlyRent: "0",
          requestedLoan: "612000",
        },
      }).map((row) => row.label),
    ).toEqual(["Requested loan", "Current value", "LTV"]);
    expect(
      dealSnapshotMetrics({
        loanType: "DSCR Purchase",
        loanAmount: 612000,
        intake: {
          source: "sandbox_application",
          currentValue: "750000",
          monthlyRent: "4200",
          requestedLoan: "612000",
        },
      }).some((row) => row.label === "DSCR"),
    ).toBe(false);
  });

  it("keeps next-action copy presentational", () => {
    expect(
      nextActionPresentation({
        action: "Review replacement Government-issued ID",
        target: "documents",
      }),
    ).toEqual({
      context: "A replacement document has been received and needs processor review.",
      cta: "Review document",
    });
    expect(
      nextActionPresentation({
        action: "Prepare lender submission",
        target: "submission",
      }),
    ).toEqual({
      context:
        "Required-now items are complete. Prepare the lender package from stored file facts.",
      cta: "Open submission",
    });
  });
});
