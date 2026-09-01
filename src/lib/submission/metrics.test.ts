import { describe, expect, it } from "vitest";
import {
  deriveSubmissionMetrics,
  submissionFinancialInputs,
} from "@/lib/submission/metrics";

describe("submission financial metrics", () => {
  it("calculates LTV, LTC, and ARV ratios from stored numbers only", () => {
    const metrics = deriveSubmissionMetrics({
      loan: 400000,
      purchase: 500000,
      rehab: 100000,
      arv: 800000,
      value: null,
    });
    expect(metrics.find((row) => row.key === "ltv")?.value).toBe("80%");
    expect(metrics.find((row) => row.key === "ltc")?.value).toBe("66.7%");
    expect(metrics.find((row) => row.key === "loan_purchase")?.value).toBe("80%");
    expect(metrics.find((row) => row.key === "loan_arv")?.value).toBe("50%");
  });

  it("omits ratios when a source value is missing", () => {
    expect(
      deriveSubmissionMetrics({
        loan: 400000,
        purchase: null,
        rehab: null,
        arv: null,
        value: null,
      }),
    ).toEqual([]);
    expect(
      deriveSubmissionMetrics({
        loan: null,
        purchase: 500000,
        rehab: 100000,
        arv: 800000,
        value: 500000,
      }),
    ).toEqual([]);
  });

  it("does not invent values from blank intake strings", () => {
    expect(
      submissionFinancialInputs({
        loanAmount: null,
        requestedLoan: "",
        purchasePrice: "not-a-number",
      }),
    ).toEqual({
      loan: null,
      purchase: null,
      rehab: null,
      arv: null,
      value: null,
    });
  });
});
