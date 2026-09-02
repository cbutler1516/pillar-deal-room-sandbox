import type { OperationalWorkItem } from "@/lib/ops/operational-work";
import { queueFilterHref } from "@/lib/command-center/filters";
import { formatWaitingAgeLabel } from "@/lib/command-center/aging";

export const WAITING_ON_GROUPS = [
  "borrower",
  "title",
  "insurance",
  "appraiser",
  "contractor",
  "lender",
  "other",
] as const;

export type WaitingOnGroup = (typeof WAITING_ON_GROUPS)[number];

export type WaitingOnRow = {
  key: WaitingOnGroup;
  label: string;
  count: number;
  oldestDays: number;
  oldestLabel: string | null;
  href: string;
};

const GROUP_LABELS: Record<WaitingOnGroup, string> = {
  borrower: "Borrowers",
  title: "Title",
  insurance: "Insurance",
  appraiser: "Appraiser",
  contractor: "Contractor",
  lender: "Lender",
  other: "Other",
};

function resolveGroup(
  row: OperationalWorkItem,
  tasks: { id: string; sourceType: string | null }[],
): WaitingOnGroup {
  let source: string | null = null;
  if (row.sourceKind === "task") {
    source = tasks.find((task) => task.id === row.sourceId)?.sourceType ?? null;
  } else if (row.sourceKind === "contact") {
    source = row.sourceId.split(":")[1] ?? null;
  }
  if (!source) {
    const reason = row.reason.toLowerCase();
    if (reason.includes("borrower")) return "borrower";
    if (reason.includes("insurance")) return "insurance";
    if (reason.includes("title")) return "title";
    if (reason.includes("contractor")) return "contractor";
    if (reason.includes("lender")) return "lender";
    if (reason.includes("appraiser")) return "appraiser";
    return "other";
  }
  if (source === "borrower" || source === "co_borrower") return "borrower";
  if (source === "title" || source === "escrow" || source === "closing_attorney") {
    return "title";
  }
  if (source === "insurance") return "insurance";
  if (source === "appraiser") return "appraiser";
  if (source === "contractor" || source === "property_manager") return "contractor";
  if (source === "lender") return "lender";
  return "other";
}

export function deriveWaitingOnGroups(input: {
  items: OperationalWorkItem[];
  tasks: { id: string; sourceType: string | null; waitingSince?: string | null }[];
  assignment?: string;
  now?: Date;
}): WaitingOnRow[] {
  const now = input.now ?? new Date();
  const waitingItems = input.items.filter((row) => row.queueSection === "waiting");
  const buckets = new Map<
    WaitingOnGroup,
    { count: number; oldest: Date | null }
  >();

  for (const key of WAITING_ON_GROUPS) {
    buckets.set(key, { count: 0, oldest: null });
  }

  for (const row of waitingItems) {
    const group = resolveGroup(row, input.tasks);
    const bucket = buckets.get(group)!;
    bucket.count += 1;
    const task = input.tasks.find((item) => item.id === row.sourceId);
    const anchor = task?.waitingSince ?? row.dueAt;
    if (anchor) {
      const at = new Date(anchor);
      if (!bucket.oldest || at.getTime() < bucket.oldest.getTime()) {
        bucket.oldest = at;
      }
    }
  }

  return WAITING_ON_GROUPS.map((key) => {
    const bucket = buckets.get(key)!;
    const oldestLabel = bucket.oldest
      ? formatWaitingAgeLabel(bucket.oldest.toISOString(), now)
      : null;
    const oldestDays = bucket.oldest
      ? Math.max(
          0,
          Math.floor((now.getTime() - bucket.oldest.getTime()) / 86_400_000),
        )
      : 0;
    return {
      key,
      label: GROUP_LABELS[key],
      count: bucket.count,
      oldestDays,
      oldestLabel,
      href: queueFilterHref({
        assignment: input.assignment,
        bucket: "waiting",
        source: key === "other" ? "other" : key,
      }),
    };
  }).filter((row) => row.count > 0);
}
