import { describe, expect, it } from "vitest";
import {
  conditionQueueAction,
  conditionQueueReason,
  conditionStatus,
  conditionStatusLabel,
  conditionSummary,
  formatConditionInstructions,
  isLenderCondition,
  parseConditionSource,
} from "@/lib/conditions/model";

describe("condition model", () => {
  it("identifies lender-source tasks as conditions", () => {
    expect(isLenderCondition({ sourceType: "lender" })).toBe(true);
    expect(isLenderCondition({ taskType: "lender_condition" })).toBe(true);
    expect(isLenderCondition({ sourceType: "borrower" })).toBe(false);
  });

  it("maps task and need state to processor status labels", () => {
    expect(conditionStatus({ status: "completed" })).toBe("cleared");
    expect(conditionStatus({ status: "open" }, { status: "needs_review" })).toBe(
      "needs_review",
    );
    expect(conditionStatus({ status: "open" }, { status: "received" })).toBe(
      "received",
    );
    expect(conditionStatus({ status: "waiting" })).toBe("waiting");
    expect(conditionStatus({ status: "open" })).toBe("open");
    expect(conditionStatusLabel("needs_review")).toBe("Needs review");
    expect(conditionStatusLabel("cleared")).toBe("Cleared");
  });

  it("maps actionable work to Queue copy without inventing a new rank", () => {
    expect(conditionQueueReason("follow_up_overdue")).toBe(
      "Condition still outstanding",
    );
    expect(conditionQueueAction("follow_up_overdue")).toBe("Follow up");
    expect(conditionQueueReason("document_awaiting_review")).toBe(
      "Condition response received",
    );
    expect(conditionQueueAction("document_awaiting_review")).toBe(
      "Review condition",
    );
  });

  it("summarizes open, received, and waiting conditions", () => {
    const summary = conditionSummary({
      tasks: [
        { sourceType: "lender", status: "open", clientNeedId: "n1" },
        { sourceType: "lender", status: "waiting", clientNeedId: null },
        { sourceType: "lender", status: "open", clientNeedId: "n2" },
        { sourceType: "borrower", status: "open", clientNeedId: "n3" },
        { sourceType: "lender", status: "completed", clientNeedId: null },
      ],
      needs: [
        { id: "n1", status: "requested" },
        { id: "n2", status: "received" },
        { id: "n3", status: "missing" },
      ],
    });
    expect(summary).toEqual({
      open: 1,
      received: 1,
      waiting: 1,
      review: 0,
      cleared: 1,
    });
  });

  it("stores lender name in instructions without a new column", () => {
    expect(parseConditionSource(formatConditionInstructions("Northwind", "Need updated ID"))).toBe(
      "Northwind",
    );
  });
});
