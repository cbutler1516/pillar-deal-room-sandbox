import { describe, expect, it } from "vitest";
import {
  formatDueTodayLabel,
  formatOperationalAge,
  formatWaitingAgeLabel,
  staffDaysBetween,
} from "@/lib/command-center/aging";
import { deriveConditionsSnapshot } from "@/lib/command-center/conditions";
import {
  buildMorningBrief,
  computeTodayStripCounts,
  countFollowUpsDue,
  deriveMyNextFive,
  deriveReadyToSubmit,
  deriveRecentResponses,
  deriveTeamOverviewTotals,
  deriveUnassignedFiles,
  formatCommandCenterSummary,
  isManagerRole,
} from "@/lib/command-center/derive";
import { deriveDocumentReviewInbox } from "@/lib/command-center/documents-inbox";
import {
  filterOperationalWork,
  myAssignedWork,
  queueFilterHref,
  workItemMatchesAssignment,
  workItemMatchesBucket,
  workItemMatchesSource,
} from "@/lib/command-center/filters";
import {
  deriveSinceYesterday,
  formatSinceYesterdaySummary,
} from "@/lib/command-center/since-yesterday";
import { countStuckFiles, deriveStuckFiles, isStuckWorkItem } from "@/lib/command-center/stuck";
import { deriveWaitingOnGroups } from "@/lib/command-center/waiting-on";
import type { OperationalWorkItem } from "@/lib/ops/operational-work";
import {
  collectOperationalWork,
  computeOperationalDashboardCounts,
} from "@/lib/ops/operational-work";

const NOW = new Date("2026-08-31T18:00:00.000Z");

function work(
  partial: Partial<OperationalWorkItem> &
    Pick<OperationalWorkItem, "id" | "workType" | "queueSection">,
): OperationalWorkItem {
  return {
    dealId: "deal-1",
    dealReference: "PDR-SBX-001",
    borrowerName: "Casey Nguyen",
    entityName: null,
    loanType: "Fix & Flip",
    title: "Insurance",
    reason: "Follow-up overdue by 2 days",
    recommendedAction: "Follow up",
    priorityBand: "high",
    priorityRank: 5,
    dueState: "overdue",
    sourceKind: "task",
    sourceId: partial.id,
    assignedProcessorId: "proc-chris",
    waitingState: "overdue_response",
    dueAt: "2026-08-29T18:00:00.000Z",
    href: "/deals/deal-1?tab=tasks",
    target: "tasks",
    ...partial,
  };
}

describe("command center filters", () => {
  const items = [
    work({ id: "w1", workType: "follow_up_overdue", queueSection: "due_today" }),
    work({
      id: "w2",
      workType: "document_awaiting_review",
      queueSection: "needs_review",
      assignedProcessorId: null,
    }),
    work({
      id: "w3",
      workType: "waiting_on_response",
      queueSection: "waiting",
      sourceKind: "task",
    }),
  ];

  it("filters mine assignment without new priority logic", () => {
    expect(workItemMatchesAssignment(items[0]!, "mine", "proc-chris")).toBe(true);
    expect(workItemMatchesAssignment(items[1]!, "mine", "proc-chris")).toBe(false);
    expect(myAssignedWork(items, "proc-chris")).toHaveLength(2);
  });

  it("filters unassigned rows", () => {
    expect(
      filterOperationalWork({
        items,
        assignment: "unassigned",
        currentUserId: "proc-chris",
        tasks: [],
      }),
    ).toHaveLength(1);
  });

  it("composes bucket filters", () => {
    expect(workItemMatchesBucket(items[0]!, "due_today")).toBe(true);
    expect(workItemMatchesBucket(items[1]!, "review")).toBe(true);
    expect(workItemMatchesBucket(items[2]!, "waiting")).toBe(true);
    expect(queueFilterHref({ assignment: "mine", bucket: "review" })).toBe(
      "/processor-queue?assignment=mine&bucket=review&work=review",
    );
  });

  it("filters by communication source truth", () => {
    const tasks = [{ id: "w3", sourceType: "insurance" }];
    expect(workItemMatchesSource(items[2]!, "insurance", tasks)).toBe(true);
    expect(workItemMatchesSource(items[2]!, "borrower", tasks)).toBe(false);
  });
});

describe("my next 5 ranking", () => {
  it("uses existing operational ranking order for assigned work", () => {
    const items = collectOperationalWork({
      deals: [
        {
          id: "deal-casey",
          dealReference: "PDR-APP-3E451176",
          borrowerName: "Casey Nguyen",
          status: "new",
          assignedProcessorId: "proc-chris",
        },
      ],
      needs: [
        {
          id: "need-id",
          dealId: "deal-casey",
          documentType: "Government-issued ID",
          required: true,
          status: "rejected",
        },
      ],
      documents: [
        {
          id: "doc-id-replacement",
          dealId: "deal-casey",
          documentType: "Government-issued ID",
          status: "needs_review",
          fileName: "casey-id-replacement.pdf",
          linkedNeedIds: ["need-id"],
        },
      ],
      tasks: [
        {
          id: "task-insurance",
          dealId: "deal-casey",
          title: "Request Insurance",
          status: "waiting",
          sourceType: "insurance",
          lastContactedAt: "2026-08-20T10:00:00.000Z",
          waitingSince: "2026-08-20T10:00:00.000Z",
          nextFollowUpAt: "2026-08-28T10:00:00.000Z",
        },
      ],
      now: NOW,
    });

    const mine = deriveMyNextFive(items, "proc-chris");
    expect(mine).toHaveLength(Math.min(5, items.length));
    expect(mine[0]?.workType).toBe("replacement_received");
    expect(mine.map((row) => row.priorityRank)).toEqual(
      [...mine.map((row) => row.priorityRank)].sort((a, b) => a - b),
    );
  });
});

describe("stuck files", () => {
  it("derives stuck files only from deterministic evidence", () => {
    const items = [
      work({ id: "s1", workType: "replacement_needed", queueSection: "urgent" }),
      work({
        id: "s2",
        workType: "follow_up_overdue",
        queueSection: "due_today",
        borrowerName: "Avery Quinn",
        dealId: "deal-2",
      }),
      work({
        id: "s3",
        workType: "waiting_on_response",
        queueSection: "waiting",
        dealId: "deal-3",
        waitingState: "contacted_waiting",
        dueState: "waiting",
      }),
    ];
    expect(isStuckWorkItem(items[0]!, [])).toBe(true);
    expect(isStuckWorkItem(items[2]!, [])).toBe(false);
    const stuck = deriveStuckFiles({ items, tasks: [], limit: 3 });
    expect(stuck.map((row) => row.borrowerName)).toEqual([
      "Casey Nguyen",
      "Avery Quinn",
    ]);
    expect(countStuckFiles(items, [])).toBe(2);
  });
});

describe("waiting on grouping", () => {
  it("groups waiting work by source with oldest wait", () => {
    const items = [
      work({
        id: "w1",
        workType: "waiting_on_response",
        queueSection: "waiting",
        sourceKind: "task",
      }),
      work({
        id: "w2",
        workType: "waiting_on_response",
        queueSection: "waiting",
        sourceKind: "task",
        borrowerName: "Jordan Lee",
        dealId: "deal-4",
      }),
    ];
    const groups = deriveWaitingOnGroups({
      items,
      tasks: [
        { id: "w1", sourceType: "borrower", waitingSince: "2026-08-28T10:00:00.000Z" },
        { id: "w2", sourceType: "insurance", waitingSince: "2026-08-25T10:00:00.000Z" },
      ],
      now: NOW,
    });
    expect(groups.find((row) => row.key === "borrower")?.count).toBe(1);
    expect(groups.find((row) => row.key === "insurance")?.oldestLabel).toMatch(
      /Waiting \d+ day/,
    );
  });
});

describe("recent responses and document inbox", () => {
  it("derives recent responses from response_received work", () => {
    const rows = deriveRecentResponses({
      items: [
        work({
          id: "r1",
          workType: "response_received",
          queueSection: "needs_review",
          title: "Insurance binder task",
          borrowerName: "Jordan Lee",
          dueAt: "2026-08-31T17:48:00.000Z",
        }),
      ],
      now: NOW,
    });
    expect(rows[0]?.borrowerName).toBe("Jordan Lee");
    expect(rows[0]?.taskTitle).toBe("Insurance binder task");
  });

  it("lists highest-priority review docs without confidence", () => {
    const rows = deriveDocumentReviewInbox({
      items: [
        work({
          id: "d1",
          workType: "document_awaiting_review",
          queueSection: "needs_review",
          sourceKind: "document",
          sourceId: "doc-1",
          title: "Bank Statements",
        }),
      ],
      documents: [
        {
          id: "doc-1",
          dealId: "deal-1",
          fileName: "july-statement.pdf",
          documentType: "Bank Statements",
          status: "needs_review",
        },
      ],
      limit: 3,
    });
    expect(rows[0]?.fileName).toBe("july-statement.pdf");
    expect(rows[0]?.intelligenceFlag).toBeNull();
  });
});

describe("ready, unassigned, conditions, since yesterday", () => {
  it("derives ready-to-submit from readiness work type", () => {
    const rows = deriveReadyToSubmit({
      items: [
        work({
          id: "ready-1",
          workType: "ready_to_submit",
          queueSection: "due_today",
        }),
      ],
      deals: [
        {
          id: "deal-1",
          loanType: "Fix & Flip",
          loanAmount: 350000,
          assignedProcessorId: "proc-chris",
        },
      ],
    });
    expect(rows[0]?.href).toContain("tab=submission");
    expect(rows[0]?.loanType).toBe("Fix & Flip");
  });

  it("derives unassigned top files", () => {
    const rows = deriveUnassignedFiles({
      items: [
        work({
          id: "u1",
          workType: "unassigned_file",
          queueSection: "new",
          assignedProcessorId: null,
        }),
      ],
    });
    expect(rows).toHaveLength(1);
  });

  it("counts lender conditions by status", () => {
    const snapshot = deriveConditionsSnapshot({
      tasks: [
        {
          id: "c1",
          status: "open",
          sourceType: "lender",
          clientNeedId: "n1",
        },
        {
          id: "c2",
          status: "waiting",
          sourceType: "lender",
        },
      ],
      needs: [{ id: "n1", status: "needs_review" }],
    });
    expect(snapshot.needsReview).toBe(1);
    expect(snapshot.waiting).toBe(1);
  });

  it("summarizes since-yesterday activity without AI", () => {
    const counts = deriveSinceYesterday({
      activity: [
        {
          id: "a1",
          dealId: "d1",
          eventType: "application_received",
          actorType: "system",
          actorId: null,
          createdAt: "2026-08-31T10:00:00.000Z",
          safeMetadata: {},
        },
        {
          id: "a2",
          dealId: "d1",
          eventType: "document_metadata_recorded",
          actorType: "system",
          actorId: null,
          createdAt: "2026-08-31T11:00:00.000Z",
          safeMetadata: {},
        },
      ],
      communications: [],
      now: NOW,
    });
    expect(counts.newApplications).toBe(1);
    expect(formatSinceYesterdaySummary(counts)).toContain("new application");
  });
});

describe("manager and morning brief", () => {
  it("identifies manager role as admin only", () => {
    expect(isManagerRole("admin")).toBe(true);
    expect(isManagerRole("processor")).toBe(false);
  });

  it("derives team totals without ranking processors", () => {
    const totals = deriveTeamOverviewTotals({
      deals: [
        { id: "1", assignedProcessorId: "p1", status: "processor_review" },
        { id: "2", assignedProcessorId: null, status: "new" },
      ],
      items: [
        work({ id: "t1", workType: "escalated_task", queueSection: "urgent" }),
        work({
          id: "t2",
          workType: "ready_to_submit",
          queueSection: "due_today",
        }),
      ],
    });
    expect(totals.totalActiveWork).toBe(2);
    expect(totals.unassigned).toBe(1);
    expect(totals.urgent).toBe(1);
    expect(totals.ready).toBe(1);
  });

  it("morning brief cannot execute and derives from structured snapshot", () => {
    const brief = buildMorningBrief({
      myNextFive: [
        work({ id: "m1", workType: "replacement_needed", queueSection: "urgent" }),
      ],
      stuckFiles: [{ borrowerName: "Casey Nguyen", reason: "Replacement needed" }],
      readyToSubmit: [{ borrowerName: "Casey Brooks" }],
    });
    expect(brief?.canExecute).toBe(false);
    expect(brief?.text).toContain("Casey Nguyen");
    expect(brief?.disclaimer).toMatch(/No actions are taken automatically/);
  });
});

describe("aging in America/Los_Angeles staff clock", () => {
  it("uses relative staff-time wording", () => {
    expect(formatOperationalAge("2026-08-31T17:30:00.000Z", NOW)).toMatch(
      /Received \d+m ago/,
    );
    expect(formatDueTodayLabel("2026-08-31T07:00:00.000Z", NOW)).toBe("Due today");
    expect(formatWaitingAgeLabel("2026-08-28T18:00:00.000Z", NOW)).toMatch(
      /Waiting \d+ day/,
    );
    expect(staffDaysBetween(new Date("2026-08-29T18:00:00.000Z"), NOW)).toBe(2);
  });
});

describe("queue truth preservation", () => {
  it("does not introduce a new priority engine in dashboard counts", () => {
    const items = collectOperationalWork({
      deals: [
        {
          id: "deal-casey",
          dealReference: "PDR-APP-3E451176",
          borrowerName: "Casey Nguyen",
          status: "new",
          assignedProcessorId: null,
        },
      ],
      needs: [
        {
          id: "need-id",
          dealId: "deal-casey",
          documentType: "Government-issued ID",
          required: true,
          status: "rejected",
        },
      ],
      documents: [
        {
          id: "doc-id-replacement",
          dealId: "deal-casey",
          documentType: "Government-issued ID",
          status: "needs_review",
          fileName: "casey-id-replacement.pdf",
          linkedNeedIds: ["need-id"],
        },
      ],
      tasks: [],
      now: NOW,
    });
    const counts = computeOperationalDashboardCounts(items);
    expect(formatCommandCenterSummary({
      needsAttention: counts.needsAttention,
      followUpsDue: countFollowUpsDue(items),
      docsToReview: counts.docsToReview,
    })).toContain("document");
    expect(computeTodayStripCounts(items).docsToReview).toBeGreaterThan(0);
  });
});
