import type { OperationalWorkItem } from "@/lib/ops/operational-work";
import { humanizeWorkReason } from "@/lib/ui/staff-copy";
import { formatOperationalAge } from "@/lib/command-center/aging";

export type RecentResponseRow = {
  id: string;
  borrowerName: string;
  taskTitle: string;
  ageLabel: string;
  href: string;
};

export function deriveRecentResponses(input: {
  items: OperationalWorkItem[];
  limit?: number;
  now?: Date;
}): RecentResponseRow[] {
  const limit = input.limit ?? 6;
  return input.items
    .filter((row) => row.workType === "response_received")
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      borrowerName: row.borrowerName,
      taskTitle: row.title,
      ageLabel:
        formatOperationalAge(row.dueAt, input.now) ??
        humanizeWorkReason(row.reason),
      href: row.href,
    }));
}

export type MorningBriefResult = {
  text: string;
  highlights: string[];
  disclaimer: string;
  canExecute: false;
};

export function buildMorningBrief(input: {
  myNextFive: OperationalWorkItem[];
  stuckFiles: { borrowerName: string; reason: string }[];
  readyToSubmit: { borrowerName: string }[];
  now?: Date;
}): MorningBriefResult | null {
  const highlights: string[] = [];

  for (const row of input.stuckFiles.slice(0, 2)) {
    highlights.push(`${row.borrowerName} — ${row.reason}`);
  }
  for (const row of input.myNextFive.slice(0, 3)) {
    if (highlights.some((line) => line.startsWith(row.borrowerName))) {
      continue;
    }
    highlights.push(`${row.borrowerName} — ${humanizeWorkReason(row.reason)}`);
  }
  for (const row of input.readyToSubmit.slice(0, 1)) {
    if (!highlights.some((line) => line.startsWith(row.borrowerName))) {
      highlights.push(`${row.borrowerName} is ready to send.`);
    }
  }

  if (highlights.length === 0) {
    return null;
  }

  const lead =
    highlights.length >= 3
      ? "Most attention is concentrated in three files:"
      : "Focus areas for today:";

  return {
    text: `${lead}\n${highlights.slice(0, 3).join("\n")}`,
    highlights: highlights.slice(0, 3),
    disclaimer:
      "Suggestion only — from live file state. No actions are taken automatically.",
    canExecute: false,
  };
}

export type ReadyToSubmitRow = {
  dealId: string;
  borrowerName: string;
  loanType: string | null;
  loanAmount: number | null;
  processorId: string | null;
  href: string;
};

export type UnassignedFileRow = {
  id: string;
  dealId: string;
  borrowerName: string;
  reason: string;
  href: string;
};

export type TodayStripCounts = {
  dueToday: number;
  overdue: number;
  docsToReview: number;
  waiting: number;
  readyToSubmit: number;
};

export function computeTodayStripCounts(
  items: OperationalWorkItem[],
): TodayStripCounts {
  const overdue = items.filter((row) => row.dueState === "overdue").length;
  const dueTodayItems = items.filter(
    (row) =>
      row.dueState === "due_today" ||
      row.workType === "follow_up_due_today",
  ).length;
  return {
    dueToday: dueTodayItems,
    overdue,
    docsToReview: items.filter(
      (row) =>
        row.workType === "document_awaiting_review" ||
        row.workType === "replacement_received" ||
        row.workType === "document_mismatch" ||
        row.workType === "response_received",
    ).length,
    waiting: items.filter((row) => row.queueSection === "waiting").length,
    readyToSubmit: items.filter((row) => row.workType === "ready_to_submit").length,
  };
}

export function deriveMyNextFive(
  items: OperationalWorkItem[],
  userId: string,
): OperationalWorkItem[] {
  return items.filter((row) => row.assignedProcessorId === userId).slice(0, 5);
}

export function deriveReadyToSubmit(input: {
  items: OperationalWorkItem[];
  deals: {
    id: string;
    loanType: string | null;
    loanAmount: number | null;
    assignedProcessorId: string | null;
  }[];
  limit?: number;
}): ReadyToSubmitRow[] {
  const limit = input.limit ?? 3;
  const seen = new Set<string>();
  const rows: ReadyToSubmitRow[] = [];
  for (const item of input.items) {
    if (item.workType !== "ready_to_submit") {
      continue;
    }
    if (seen.has(item.dealId)) {
      continue;
    }
    seen.add(item.dealId);
    const deal = input.deals.find((row) => row.id === item.dealId);
    rows.push({
      dealId: item.dealId,
      borrowerName: item.borrowerName,
      loanType: deal?.loanType ?? item.loanType,
      loanAmount: deal?.loanAmount ?? null,
      processorId: deal?.assignedProcessorId ?? item.assignedProcessorId,
      href: `/deals/${item.dealId}?tab=submission`,
    });
    if (rows.length >= limit) {
      break;
    }
  }
  return rows;
}

export function deriveUnassignedFiles(input: {
  items: OperationalWorkItem[];
  limit?: number;
}): UnassignedFileRow[] {
  const limit = input.limit ?? 3;
  return input.items
    .filter(
      (row) =>
        !row.assignedProcessorId &&
        (row.workType === "unassigned_file" || row.workType === "new_application"),
    )
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      dealId: row.dealId,
      borrowerName: row.borrowerName,
      reason: row.reason,
      href: `/deals/${row.dealId}`,
    }));
}

export function formatCommandCenterSummary(input: {
  needsAttention: number;
  followUpsDue: number;
  docsToReview: number;
}): string {
  const parts: string[] = [];
  if (input.needsAttention > 0) {
    parts.push(
      input.needsAttention === 1
        ? "1 file needs your attention"
        : `${input.needsAttention} files need your attention`,
    );
  }
  if (input.followUpsDue > 0) {
    parts.push(
      input.followUpsDue === 1
        ? "1 follow-up due"
        : `${input.followUpsDue} follow-ups due`,
    );
  }
  if (input.docsToReview > 0) {
    parts.push(
      input.docsToReview === 1
        ? "1 document ready for review"
        : `${input.docsToReview} documents ready for review`,
    );
  }
  if (parts.length === 0) {
    return "You're clear for now.";
  }
  return parts.join(" · ");
}

export function countFollowUpsDue(items: OperationalWorkItem[]): number {
  return items.filter(
    (row) =>
      row.workType === "follow_up_overdue" ||
      row.workType === "follow_up_due_today" ||
      row.workType === "waiting_beyond_cadence",
  ).length;
}

export function isManagerRole(role: string | null | undefined): boolean {
  return role === "admin";
}

export type TeamOverviewTotals = {
  totalActiveWork: number;
  unassigned: number;
  urgent: number;
  review: number;
  waiting: number;
  ready: number;
};

export function deriveTeamOverviewTotals(input: {
  items: OperationalWorkItem[];
  deals: { id: string; assignedProcessorId: string | null; status: string }[];
}): TeamOverviewTotals {
  const activeDeals = input.deals.filter(
    (deal) => !["closed", "withdrawn", "submitted"].includes(deal.status),
  );
  return {
    totalActiveWork: activeDeals.length,
    unassigned: activeDeals.filter((deal) => !deal.assignedProcessorId).length,
    urgent: input.items.filter((row) => row.queueSection === "urgent").length,
    review: input.items.filter(
      (row) =>
        row.workType === "document_awaiting_review" ||
        row.workType === "replacement_received" ||
        row.workType === "response_received",
    ).length,
    waiting: input.items.filter((row) => row.queueSection === "waiting").length,
    ready: input.items.filter((row) => row.workType === "ready_to_submit").length,
  };
}
