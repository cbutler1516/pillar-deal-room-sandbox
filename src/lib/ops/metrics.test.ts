import { describe, expect, it } from "vitest";
import { DEMO_DEALS } from "@/lib/demo/catalog";
import {
  computeDashboardCounts,
  dealExceptionCount,
  documentCompletion,
} from "@/lib/ops/metrics";

const deals = DEMO_DEALS.map((deal) => ({
  id: deal.id,
  status: deal.status,
  assignedProcessorId: null,
  createdAt: deal.createdAt,
}));
const needs = DEMO_DEALS.flatMap((deal) =>
  deal.needs.map((need) => ({
    dealId: deal.id,
    required: need.required,
    status: need.status,
  })),
);
const documents = DEMO_DEALS.flatMap((deal) =>
  deal.documents.map((doc) => ({ dealId: deal.id, status: doc.status })),
);
const tasks = DEMO_DEALS.flatMap((deal) =>
  deal.tasks.map((task) => ({
    dealId: deal.id,
    priority: task.priority,
    status: task.status,
  })),
);

describe("dashboard counts", () => {
  it("uses the agreed operational definitions", () => {
    expect(computeDashboardCounts(deals, needs, documents, tasks)).toEqual({
      newDeals: 1,
      needsDocuments: 2,
      documentsToReview: 4,
      readyForSubmission: 1,
      exceptions: 3,
    });
  });

  it("counts required document completion", () => {
    const ready = DEMO_DEALS.find((deal) => deal.status === "ready_for_submission");
    expect(ready).toBeDefined();
    const completion = documentCompletion(ready!.id, needs);
    expect(completion.complete).toBe(completion.required);
    expect(completion.required).toBeGreaterThan(0);
  });

  it("treats rejected items and hot tasks as exceptions", () => {
    const bridge = DEMO_DEALS.find((deal) => deal.loanType === "Commercial Bridge");
    expect(dealExceptionCount(bridge!.id, needs, documents, tasks)).toBeGreaterThan(0);
  });
});
