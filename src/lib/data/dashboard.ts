import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDealSnapshot, type SnapshotDeal } from "@/lib/data/snapshot";
import {
  ageInDays,
  computeDashboardCounts,
  dealExceptionCount,
  dealHasDocsToReview,
  documentCompletion,
  isNeedsDocumentsStatus,
  priorityScore,
  type DashboardCounts,
} from "@/lib/ops/metrics";

export type { DashboardCounts };

export type PriorityQueueRow = SnapshotDeal & {
  documentComplete: number;
  documentRequired: number;
  exceptionCount: number;
  ageDays: number;
};

export async function getDashboardCounts(
  supabase: SupabaseClient,
): Promise<DashboardCounts> {
  const snapshot = await loadDealSnapshot(supabase);
  return computeDashboardCounts(
    snapshot.deals,
    snapshot.needs,
    snapshot.documents,
    snapshot.tasks,
  );
}

export async function getPriorityQueue(
  supabase: SupabaseClient,
): Promise<PriorityQueueRow[]> {
  const snapshot = await loadDealSnapshot(supabase);
  return snapshot.deals
    .map((deal) => {
      const completion = documentCompletion(deal.id, snapshot.needs);
      const row: PriorityQueueRow = {
        ...deal,
        documentComplete: completion.complete,
        documentRequired: completion.required,
        exceptionCount: dealExceptionCount(
          deal.id,
          snapshot.needs,
          snapshot.documents,
          snapshot.tasks,
        ),
        ageDays: ageInDays(deal.createdAt),
      };
      return {
        row,
        score: priorityScore(
          deal,
          snapshot.needs,
          snapshot.documents,
          snapshot.tasks,
        ),
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.row);
}

export function queueSectionIds(
  deals: SnapshotDeal[],
  needs: Parameters<typeof dealExceptionCount>[1],
  documents: Parameters<typeof dealExceptionCount>[2],
  tasks: Parameters<typeof dealExceptionCount>[3],
) {
  return {
    unassigned: deals.filter((deal) => !deal.assignedProcessorId).map((d) => d.id),
    missingItems: deals
      .filter((deal) => isNeedsDocumentsStatus(deal.status))
      .map((d) => d.id),
    documentsToReview: deals
      .filter((deal) => dealHasDocsToReview(deal.id, documents))
      .map((d) => d.id),
    exceptions: deals
      .filter(
        (deal) => dealExceptionCount(deal.id, needs, documents, tasks) > 0,
      )
      .map((d) => d.id),
    readyForSubmission: deals
      .filter((deal) => deal.status === "ready_for_submission")
      .map((d) => d.id),
  };
}
