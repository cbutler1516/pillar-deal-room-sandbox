import {
  isDocumentReviewWork,
  type OperationalWorkItem,
  workItemMatchesFilter,
} from "@/lib/ops/operational-work";

export const QUEUE_ASSIGNMENT_FILTERS = ["all", "mine", "unassigned"] as const;
export type QueueAssignmentFilter = (typeof QUEUE_ASSIGNMENT_FILTERS)[number];

export const QUEUE_BUCKET_FILTERS = [
  "urgent",
  "due_today",
  "review",
  "waiting",
  "new",
  "ready",
] as const;
export type QueueBucketFilter = (typeof QUEUE_BUCKET_FILTERS)[number];

export const QUEUE_SOURCE_FILTERS = [
  "borrower",
  "title",
  "insurance",
  "appraiser",
  "contractor",
  "lender",
  "other",
] as const;
export type QueueSourceFilter = (typeof QUEUE_SOURCE_FILTERS)[number];

export function bucketToWorkFilter(bucket: QueueBucketFilter): string {
  switch (bucket) {
    case "urgent":
      return "escalated";
    case "due_today":
      return "follow_up";
    case "review":
      return "review";
    case "waiting":
      return "waiting";
    case "new":
      return "new";
    case "ready":
      return "ready";
  }
}

export function queueFilterHref(input: {
  assignment?: string;
  bucket?: QueueBucketFilter;
  source?: QueueSourceFilter;
  work?: string;
  q?: string;
}): string {
  const params = new URLSearchParams();
  if (input.assignment && input.assignment !== "all") {
    params.set("assignment", input.assignment);
  }
  if (input.bucket) {
    params.set("bucket", input.bucket);
    params.set("work", bucketToWorkFilter(input.bucket));
  } else if (input.work && input.work !== "all") {
    params.set("work", input.work);
  }
  if (input.source) {
    params.set("source", input.source);
  }
  if (input.q) {
    params.set("q", input.q);
  }
  const query = params.toString();
  return query ? `/processor-queue?${query}` : "/processor-queue";
}

export function workItemMatchesAssignment(
  row: OperationalWorkItem,
  assignment: string,
  currentUserId: string,
): boolean {
  if (assignment === "all") {
    return true;
  }
  if (assignment === "unassigned") {
    return !row.assignedProcessorId;
  }
  if (assignment === "mine") {
    return row.assignedProcessorId === currentUserId;
  }
  return row.assignedProcessorId === assignment;
}

export function workItemMatchesBucket(
  row: OperationalWorkItem,
  bucket: QueueBucketFilter,
): boolean {
  switch (bucket) {
    case "urgent":
      return row.queueSection === "urgent";
    case "due_today":
      return (
        row.queueSection === "due_today" ||
        row.dueState === "due_today" ||
        row.dueState === "overdue"
      );
    case "review":
      return isDocumentReviewWork(row);
    case "waiting":
      return row.queueSection === "waiting";
    case "new":
      return row.queueSection === "new";
    case "ready":
      return (
        row.workType === "ready_to_submit" || row.workType === "near_ready"
      );
  }
}

const SOURCE_ALIASES: Record<QueueSourceFilter, string[]> = {
  borrower: ["borrower", "co_borrower"],
  title: ["title", "escrow", "closing_attorney"],
  insurance: ["insurance"],
  appraiser: ["appraiser"],
  contractor: ["contractor", "property_manager"],
  lender: ["lender"],
  other: [],
};

export function taskSourceType(
  tasks: { id: string; sourceType: string | null }[],
  row: OperationalWorkItem,
): string | null {
  if (row.sourceKind === "task") {
    return tasks.find((task) => task.id === row.sourceId)?.sourceType ?? null;
  }
  if (row.sourceKind === "contact") {
    const parts = row.sourceId.split(":");
    return parts[1] ?? null;
  }
  if (row.workType === "required_contact_missing") {
    return row.reason.toLowerCase().includes("insurance")
      ? "insurance"
      : row.reason.toLowerCase().includes("title")
        ? "title"
        : row.reason.toLowerCase().includes("contractor")
          ? "contractor"
          : "other";
  }
  return null;
}

export function workItemMatchesSource(
  row: OperationalWorkItem,
  source: QueueSourceFilter,
  tasks: { id: string; sourceType: string | null }[],
): boolean {
  const type = taskSourceType(tasks, row);
  if (!type) {
    return source === "other";
  }
  const aliases = SOURCE_ALIASES[source];
  if (source === "other") {
    return !Object.entries(SOURCE_ALIASES).some(
      ([key, values]) =>
        key !== "other" && values.includes(type),
    );
  }
  return aliases.includes(type);
}

export function filterOperationalWork(input: {
  items: OperationalWorkItem[];
  assignment?: string;
  bucket?: QueueBucketFilter;
  source?: QueueSourceFilter;
  work?: string;
  currentUserId: string;
  tasks: { id: string; sourceType: string | null }[];
}): OperationalWorkItem[] {
  const assignment = input.assignment ?? "all";
  const work = input.work ?? "all";
  return input.items.filter((row) => {
    if (!workItemMatchesAssignment(row, assignment, input.currentUserId)) {
      return false;
    }
    if (input.bucket && !workItemMatchesBucket(row, input.bucket)) {
      return false;
    }
    if (input.source && !workItemMatchesSource(row, input.source, input.tasks)) {
      return false;
    }
    if (!workItemMatchesFilter(row, work)) {
      return false;
    }
    return true;
  });
}

export function myAssignedWork(
  items: OperationalWorkItem[],
  userId: string,
): OperationalWorkItem[] {
  return items.filter((row) => row.assignedProcessorId === userId);
}
