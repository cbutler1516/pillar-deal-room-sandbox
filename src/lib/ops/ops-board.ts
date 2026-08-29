import type { RankedNextAction } from "@/lib/playbooks/logic";

export const BOARD_COLUMNS = [
  { key: "todo", label: "To Do", status: "open" },
  { key: "in_progress", label: "In Progress", status: "in_progress" },
  { key: "waiting", label: "Waiting", status: "waiting" },
  { key: "done", label: "Done", status: "completed" },
] as const;

export type BoardColumnKey = (typeof BOARD_COLUMNS)[number]["key"];

export type WaitingBucket = "borrower" | "title" | "insurance" | "other";

export type OpsMetrics = {
  newDeals: number;
  requiredNow: number;
  followUpsDue: number;
  documentsToReview: number;
  waitingOnBorrower: number;
  waitingOnThirdParty: number;
  readyForSubmission: number;
  escalations: number;
};

export function greetingForHour(hour: number): string {
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 17) {
    return "Good afternoon";
  }
  return "Good evening";
}

export function firstNameFromProfile(input: {
  fullName: string | null;
  email: string;
}): string {
  const name = input.fullName?.trim();
  if (name) {
    return name.split(/\s+/)[0] ?? name;
  }
  return input.email.split("@")[0] || "there";
}

export function formatLongDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);
}

export function boardColumnForStatus(status: string): BoardColumnKey | null {
  if (status === "open") {
    return "todo";
  }
  if (status === "in_progress") {
    return "in_progress";
  }
  if (status === "waiting") {
    return "waiting";
  }
  if (status === "completed") {
    return "done";
  }
  return null;
}

export function waitingBucket(sourceType: string | null): WaitingBucket {
  if (sourceType === "borrower") {
    return "borrower";
  }
  if (sourceType === "title") {
    return "title";
  }
  if (sourceType === "insurance") {
    return "insurance";
  }
  return "other";
}

export function computeOpsMetrics(input: {
  newDeals: number;
  documentsToReview: number;
  readyForSubmission: number;
  ranked: Pick<
    RankedNextAction,
    "timing" | "followUpDue" | "escalationDue" | "status" | "sourceType"
  >[];
}): OpsMetrics {
  const waiting = input.ranked.filter((task) => task.status === "waiting");
  return {
    newDeals: input.newDeals,
    requiredNow: input.ranked.filter((task) => task.timing === "required_now")
      .length,
    followUpsDue: input.ranked.filter((task) => task.followUpDue).length,
    documentsToReview: input.documentsToReview,
    waitingOnBorrower: waiting.filter((task) => task.sourceType === "borrower")
      .length,
    waitingOnThirdParty: waiting.filter(
      (task) => task.sourceType && task.sourceType !== "borrower" && task.sourceType !== "internal",
    ).length,
    readyForSubmission: input.readyForSubmission,
    escalations: input.ranked.filter((task) => task.escalationDue).length,
  };
}

export function waitingCounts(
  tasks: { status: string; sourceType: string | null }[],
): Record<WaitingBucket, number> {
  const counts: Record<WaitingBucket, number> = {
    borrower: 0,
    title: 0,
    insurance: 0,
    other: 0,
  };
  for (const task of tasks) {
    if (task.status !== "waiting") {
      continue;
    }
    counts[waitingBucket(task.sourceType)] += 1;
  }
  return counts;
}

export function taskSearchHaystack(input: {
  borrowerName?: string | null;
  entityName?: string | null;
  dealReference?: string | null;
  propertyAddress?: string | null;
  title?: string | null;
}): string {
  return [
    input.borrowerName,
    input.entityName,
    input.dealReference,
    input.propertyAddress,
    input.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function hrefWithQuery(
  path: string,
  current: Record<string, string | undefined>,
  patch: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...patch })) {
    if (value && value !== "all") {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function matchesTaskQuery(
  haystack: string,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return haystack.includes(needle);
}
