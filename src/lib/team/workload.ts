import {
  DOCUMENT_REVIEW_TYPES,
  type OperationalWorkItem,
} from "@/lib/ops/operational-work";

export type TeamDealLike = {
  id: string;
  assignedProcessorId: string | null;
  status: string;
};

export type TeamStaffLike = {
  id: string;
  name: string;
  role: string;
};

const CLOSED = new Set(["submitted", "closed", "withdrawn"]);

export type TeamWorkloadRow = {
  id: string;
  name: string;
  role: string;
  unassigned: boolean;
  activeFiles: number;
  urgent: number;
  documentsToReview: number;
  waiting: number;
  overdueFollowUps: number;
  ready: number;
  href: string;
};

function isActiveDeal(deal: TeamDealLike): boolean {
  return !CLOSED.has(deal.status);
}

export function buildTeamWorkload(input: {
  staff: TeamStaffLike[];
  deals: TeamDealLike[];
  items: OperationalWorkItem[];
}): { rows: TeamWorkloadRow[]; unassigned: TeamWorkloadRow } {
  const rows = input.staff.map((person) => {
    const deals = input.deals.filter(
      (deal) => deal.assignedProcessorId === person.id && isActiveDeal(deal),
    );
    const items = input.items.filter(
      (row) => row.assignedProcessorId === person.id,
    );
    return summarizeRow({
      id: person.id,
      name: person.name,
      role: person.role,
      unassigned: false,
      deals,
      items,
      href: `/processor-queue?assignment=${encodeURIComponent(person.id)}`,
    });
  });

  const unassignedDeals = input.deals.filter(
    (deal) => !deal.assignedProcessorId && isActiveDeal(deal),
  );
  const unassignedItems = input.items.filter((row) => !row.assignedProcessorId);
  const unassigned = summarizeRow({
    id: "unassigned",
    name: "Unassigned",
    role: "Needs an owner",
    unassigned: true,
    deals: unassignedDeals,
    items: unassignedItems,
    href: "/processor-queue?assignment=unassigned",
  });

  return { rows, unassigned };
}

function summarizeRow(input: {
  id: string;
  name: string;
  role: string;
  unassigned: boolean;
  deals: TeamDealLike[];
  items: OperationalWorkItem[];
  href: string;
}): TeamWorkloadRow {
  return {
    id: input.id,
    name: input.name,
    role: input.role,
    unassigned: input.unassigned,
    activeFiles: input.deals.length,
    urgent: input.items.filter((row) => row.queueSection === "urgent").length,
    documentsToReview: input.items.filter((row) =>
      DOCUMENT_REVIEW_TYPES.has(row.workType),
    ).length,
    waiting: input.items.filter((row) => row.queueSection === "waiting").length,
    overdueFollowUps: input.items.filter(
      (row) =>
        row.workType === "follow_up_overdue" ||
        row.workType === "waiting_beyond_cadence",
    ).length,
    ready: input.items.filter((row) => row.workType === "ready_to_submit").length,
    href: input.href,
  };
}
