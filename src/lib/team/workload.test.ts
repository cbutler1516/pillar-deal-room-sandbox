import { describe, expect, it } from "vitest";
import { buildTeamWorkload } from "@/lib/team/workload";
import type { OperationalWorkItem } from "@/lib/ops/operational-work";

function work(
  partial: Partial<OperationalWorkItem> &
    Pick<OperationalWorkItem, "id" | "assignedProcessorId" | "workType" | "queueSection">,
): OperationalWorkItem {
  return {
    dealId: "d1",
    dealReference: "PDR-SBX-001",
    borrowerName: "Casey Nguyen",
    entityName: null,
    loanType: "Fix & Flip",
    title: "Work",
    reason: "Reason",
    recommendedAction: "Open",
    priorityBand: "normal",
    priorityRank: 12,
    dueState: "due_today",
    sourceKind: "task",
    sourceId: partial.id,
    waitingState: null,
    dueAt: null,
    href: "/processor-queue",
    target: "tasks",
    ...partial,
  };
}

describe("team workload", () => {
  it("counts real work per processor without scoring people", () => {
    const { rows, unassigned } = buildTeamWorkload({
      staff: [
        { id: "chris", name: "Chris Butler", role: "admin" },
        { id: "avery", name: "Avery Quinn", role: "processor" },
      ],
      deals: [
        { id: "1", assignedProcessorId: "chris", status: "processor_review" },
        { id: "2", assignedProcessorId: "chris", status: "missing_items" },
        { id: "3", assignedProcessorId: null, status: "new" },
        { id: "4", assignedProcessorId: "chris", status: "closed" },
      ],
      items: [
        work({
          id: "u1",
          assignedProcessorId: "chris",
          workType: "escalated_task",
          queueSection: "urgent",
        }),
        work({
          id: "r1",
          assignedProcessorId: "chris",
          workType: "document_awaiting_review",
          queueSection: "needs_review",
        }),
        work({
          id: "w1",
          assignedProcessorId: null,
          workType: "new_application",
          queueSection: "new",
        }),
      ],
    });

    expect(rows[0]).toMatchObject({
      name: "Chris Butler",
      activeFiles: 2,
      urgent: 1,
      documentsToReview: 1,
    });
    expect(rows[1].activeFiles).toBe(0);
    expect(unassigned.activeFiles).toBe(1);
    expect(unassigned.href).toBe("/processor-queue?assignment=unassigned");
    expect(rows[0].href).toContain("assignment=chris");
  });
});
