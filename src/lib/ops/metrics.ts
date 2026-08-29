import type { DealStatus } from "@/lib/data/types";

export type MetricDeal = {
  id: string;
  status: DealStatus;
  assignedProcessorId: string | null;
  createdAt: string;
};

export type MetricNeed = {
  dealId: string;
  required: boolean;
  status: string;
};

export type MetricDocument = {
  dealId: string;
  status: string;
};

export type MetricTask = {
  dealId: string;
  priority: string;
  status: string;
};

export type DashboardCounts = {
  newDeals: number;
  needsDocuments: number;
  documentsToReview: number;
  readyForSubmission: number;
  exceptions: number;
};

export function ageInDays(createdAt: string, nowMs = Date.now()): number {
  return Math.max(0, Math.round((nowMs - new Date(createdAt).getTime()) / 86_400_000));
}

export function isNeedsDocumentsStatus(status: DealStatus): boolean {
  return status === "collecting_documents" || status === "missing_items";
}

export function isOpenTask(status: string): boolean {
  return status === "open" || status === "in_progress";
}

export function isHighPriority(priority: string): boolean {
  return priority === "high" || priority === "urgent";
}

export function dealHasDocsToReview(
  dealId: string,
  documents: MetricDocument[],
): boolean {
  return documents.some(
    (doc) => doc.dealId === dealId && doc.status === "needs_review",
  );
}

export function dealExceptionCount(
  dealId: string,
  needs: MetricNeed[],
  documents: MetricDocument[],
  tasks: MetricTask[],
): number {
  const rejectedNeeds = needs.filter(
    (need) => need.dealId === dealId && need.status === "rejected",
  ).length;
  const rejectedDocs = documents.filter(
    (doc) => doc.dealId === dealId && doc.status === "rejected",
  ).length;
  const hotTasks = tasks.filter(
    (task) =>
      task.dealId === dealId &&
      isOpenTask(task.status) &&
      isHighPriority(task.priority),
  ).length;
  return rejectedNeeds + rejectedDocs + hotTasks;
}

export function documentCompletion(dealId: string, needs: MetricNeed[]): {
  complete: number;
  required: number;
} {
  const required = needs.filter((need) => need.dealId === dealId && need.required);
  const complete = required.filter(
    (need) => need.status === "approved" || need.status === "waived",
  );
  return { complete: complete.length, required: required.length };
}

export function computeDashboardCounts(
  deals: MetricDeal[],
  needs: MetricNeed[],
  documents: MetricDocument[],
  tasks: MetricTask[],
): DashboardCounts {
  const exceptionDealIds = new Set(
    deals
      .filter((deal) => dealExceptionCount(deal.id, needs, documents, tasks) > 0)
      .map((deal) => deal.id),
  );

  return {
    newDeals: deals.filter((deal) => deal.status === "new").length,
    needsDocuments: deals.filter((deal) => isNeedsDocumentsStatus(deal.status))
      .length,
    documentsToReview: deals.filter((deal) =>
      dealHasDocsToReview(deal.id, documents),
    ).length,
    readyForSubmission: deals.filter(
      (deal) => deal.status === "ready_for_submission",
    ).length,
    exceptions: exceptionDealIds.size,
  };
}

export function priorityScore(
  deal: MetricDeal,
  needs: MetricNeed[],
  documents: MetricDocument[],
  tasks: MetricTask[],
): number {
  const exceptions = dealExceptionCount(deal.id, needs, documents, tasks);
  const missing = isNeedsDocumentsStatus(deal.status) ? 2 : 0;
  const review = dealHasDocsToReview(deal.id, documents) ? 1 : 0;
  const ageDays = ageInDays(deal.createdAt);
  return exceptions * 10 + missing * 3 + review * 2 + Math.min(ageDays, 30) / 30;
}
