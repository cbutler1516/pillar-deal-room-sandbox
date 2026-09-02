import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/auth/roles";
import { listQueueCommunications } from "@/lib/communications/data";
import { getOperationalBoard } from "@/lib/data/dashboard";
import { listRecentActivity } from "@/lib/data/deals";
import {
  buildTeamWorkload,
  type TeamWorkloadRow,
} from "@/lib/team/workload";
import { deriveConditionsSnapshot } from "@/lib/command-center/conditions";
import {
  buildMorningBrief,
  computeTodayStripCounts,
  countFollowUpsDue,
  deriveMyNextFive,
  deriveReadyToSubmit,
  deriveTeamOverviewTotals,
  deriveUnassignedFiles,
  formatCommandCenterSummary,
  type MorningBriefResult,
  type ReadyToSubmitRow,
  type TeamOverviewTotals,
  type TodayStripCounts,
  type UnassignedFileRow,
} from "@/lib/command-center/derive";
import { deriveDocumentReviewInbox } from "@/lib/command-center/documents-inbox";
import { myAssignedWork } from "@/lib/command-center/filters";
import { deriveRecentResponses } from "@/lib/command-center/derive";
import { formatProperty } from "@/lib/format";
import type { OperationalDashboardCounts } from "@/lib/ops/operational-work";
import {
  deriveSinceYesterday,
  formatSinceYesterdaySummary,
  type SinceYesterdayCounts,
} from "@/lib/command-center/since-yesterday";
import { countStuckFiles, deriveStuckFiles } from "@/lib/command-center/stuck";
import { deriveWaitingOnGroups, type WaitingOnRow } from "@/lib/command-center/waiting-on";
import type { OperationalWorkItem } from "@/lib/ops/operational-work";
import type { ConditionsSnapshot } from "@/lib/command-center/conditions";
import type { DocumentReviewInboxRow } from "@/lib/command-center/documents-inbox";
import type { RecentResponseRow } from "@/lib/command-center/derive";
import type { StuckFileRow } from "@/lib/command-center/stuck";

export type CommandCenterSnapshot = {
  items: OperationalWorkItem[];
  myItems: OperationalWorkItem[];
  counts: OperationalDashboardCounts;
  summaryLine: string;
  todayStrip: TodayStripCounts;
  myNextFive: OperationalWorkItem[];
  stuckFiles: StuckFileRow[];
  stuckCount: number;
  waitingOn: WaitingOnRow[];
  recentResponses: RecentResponseRow[];
  documentInbox: DocumentReviewInboxRow[];
  conditions: ConditionsSnapshot;
  readyToSubmit: ReadyToSubmitRow[];
  unassigned: UnassignedFileRow[];
  unassignedCount: number;
  sinceYesterday: SinceYesterdayCounts;
  sinceYesterdaySummary: string;
  morningBrief: MorningBriefResult | null;
  teamOverview: TeamOverviewTotals;
  teamWorkload: { rows: TeamWorkloadRow[]; unassigned: TeamWorkloadRow };
  followUpsDue: number;
  locationByDeal: Record<string, string>;
};

export async function getCommandCenterSnapshot(
  supabase: SupabaseClient,
  input: {
    userId: string;
    role: UserRole;
    staff: { id: string; name: string; role: string }[];
    now?: Date;
  },
): Promise<CommandCenterSnapshot> {
  const now = input.now ?? new Date();
  const [{ snapshot, items, counts }, activity, communications] =
    await Promise.all([
      getOperationalBoard(supabase, now),
      listRecentActivity(supabase, 400),
      listQueueCommunications(supabase),
    ]);

  const myItems = myAssignedWork(items, input.userId);
  const myNextFive = deriveMyNextFive(items, input.userId);
  const stuckFiles = deriveStuckFiles({
    items,
    tasks: snapshot.tasks,
    limit: 6,
    now,
  });
  const readyToSubmit = deriveReadyToSubmit({
    items,
    deals: snapshot.deals,
    limit: 3,
  });
  const followUpsDue = countFollowUpsDue(myItems.length > 0 ? myItems : items);
  const sinceYesterday = deriveSinceYesterday({
    activity,
    communications,
    now,
  });

  return {
    items,
    myItems,
    counts,
    summaryLine: formatCommandCenterSummary({
      needsAttention: counts.needsAttention,
      followUpsDue,
      docsToReview: counts.docsToReview,
    }),
    todayStrip: computeTodayStripCounts(myItems.length > 0 ? myItems : items),
    myNextFive,
    stuckFiles,
    stuckCount: countStuckFiles(items, snapshot.tasks),
    waitingOn: deriveWaitingOnGroups({
      items: myItems.length > 0 ? myItems : items,
      tasks: snapshot.tasks,
      assignment: "mine",
      now,
    }),
    recentResponses: deriveRecentResponses({ items, limit: 6, now }),
    documentInbox: deriveDocumentReviewInbox({
      items,
      documents: snapshot.documents,
      limit: 5,
      now,
    }),
    conditions: deriveConditionsSnapshot({
      tasks: snapshot.tasks,
      needs: snapshot.needs,
    }),
    readyToSubmit,
    unassigned: deriveUnassignedFiles({ items, limit: 3 }),
    unassignedCount: items.filter(
      (row) =>
        !row.assignedProcessorId &&
        (row.workType === "unassigned_file" || row.workType === "new_application"),
    ).length,
    sinceYesterday,
    sinceYesterdaySummary: formatSinceYesterdaySummary(sinceYesterday),
    morningBrief: buildMorningBrief({
      myNextFive,
      stuckFiles,
      readyToSubmit,
      now,
    }),
    teamOverview: deriveTeamOverviewTotals({
      items,
      deals: snapshot.deals,
    }),
    teamWorkload: buildTeamWorkload({
      staff: input.staff,
      deals: snapshot.deals,
      items,
    }),
    followUpsDue,
    locationByDeal: Object.fromEntries(
      snapshot.deals.map((deal) => [
        deal.id,
        formatProperty(deal.propertyCity, deal.propertyState),
      ]),
    ),
  };
}
