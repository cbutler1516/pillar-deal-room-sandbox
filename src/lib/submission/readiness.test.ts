import { describe, expect, it } from "vitest";
import { evaluateSubmissionReadiness } from "@/lib/ops/workflow";

describe("submission readiness from existing engine", () => {
  it("is ready only when required-now items and conditions are clear", () => {
    expect(
      evaluateSubmissionReadiness({
        needs: [{ required: true, status: "approved", timing: "required_now" }],
        tasks: [
          {
            status: "completed",
            blockedReason: null,
            sourceType: "lender",
            playbookKey: "lender_condition",
          },
        ],
      }).ready,
    ).toBe(true);

    const blocked = evaluateSubmissionReadiness({
      needs: [{ required: true, status: "approved", timing: "required_now" }],
      tasks: [
        {
          status: "open",
          blockedReason: null,
          title: "Updated bank statement",
          sourceType: "lender",
          playbookKey: "lender_condition",
          timing: "required_now",
        },
      ],
    });
    expect(blocked.ready).toBe(false);
    expect(blocked.attention.some((item) => item.kind === "open_condition")).toBe(
      true,
    );
  });

  it("does not let a later condition block readiness", () => {
    expect(
      evaluateSubmissionReadiness({
        needs: [{ required: true, status: "approved" }],
        tasks: [
          {
            status: "open",
            blockedReason: null,
            sourceType: "lender",
            timing: "required_later",
          },
        ],
      }).ready,
    ).toBe(true);
  });
});
