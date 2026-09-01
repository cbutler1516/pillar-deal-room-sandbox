import { describe, expect, it } from "vitest";
import { buildSubmissionChecklist } from "@/lib/submission/checklist";

describe("submission checklist", () => {
  it("marks a ready file complete and a blocked file as needing attention", () => {
    const ready = buildSubmissionChecklist({
      borrowerName: "Casey Brooks",
      loanType: "Multifamily",
      needs: [
        { required: true, status: "approved", timing: "required_now" },
        { required: true, status: "waived", timing: "required_now" },
      ],
      tasks: [{ status: "completed", blockedReason: null, sourceType: "lender" }],
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
    expect(ready.every((item) => item.state === "complete")).toBe(true);

    const blocked = buildSubmissionChecklist({
      borrowerName: "Casey Nguyen",
      loanType: "Fix & Flip",
      needs: [{ required: true, status: "rejected", timing: "required_now" }],
      tasks: [
        {
          status: "open",
          blockedReason: "contact_missing",
          sourceType: "insurance",
        },
        {
          status: "open",
          blockedReason: null,
          sourceType: "lender",
          playbookKey: "lender_condition",
          timing: "required_now",
        },
      ],
      manifest: [],
    });
    expect(blocked.filter((item) => item.state === "needs_attention").length).toBeGreaterThan(
      2,
    );
  });
});
