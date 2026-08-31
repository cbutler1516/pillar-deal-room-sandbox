import { getPlaybook } from "@/lib/playbooks/registry";
import type { PlaybookDefinition } from "@/lib/playbooks/types";
import {
  type EscalationLevel,
  type InstantiatedTask,
  type TaskPriority,
  type TaskTiming,
} from "@/lib/playbooks/types";

export const ACTIVE_TASK_STATUSES = ["open", "in_progress", "waiting"] as const;

export const NEXT_ACTION_BANDS = [
  "overdue_or_escalation",
  "required_now_blocked",
  "required_now",
  "follow_up_due",
  "document_review",
  "required_later",
  "optional",
] as const;

export type NextActionBand = (typeof NEXT_ACTION_BANDS)[number];

export type RankableTask = {
  id: string;
  dealId: string;
  title: string;
  status: string;
  priority: string;
  timing: string | null;
  taskKind: string | null;
  sourceType: string | null;
  instructions: string | null;
  completionRule: string | null;
  dueAt: string | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  lastResponseAt?: string | null;
  waitingSince: string | null;
  followUpIntervalHours: number | null;
  escalationAfterHours: number | null;
  escalationLevel: string | null;
  assignedTo: string | null;
  createdAt: string | null;
  playbookKey: string | null;
  clientNeedId?: string | null;
  dealContactId?: string | null;
  blockedReason?: string | null;
  requiresContact?: boolean;
  expectedContactType?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

export type RankedNextAction = RankableTask & {
  rank: number;
  band: NextActionBand;
  followUpDue: boolean;
  escalationDue: boolean;
  overdue: boolean;
  contactMissing: boolean;
  waitingAgeHours: number | null;
  instructionsSummary: string;
};

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export function isActiveTaskStatus(status: string): boolean {
  return (ACTIVE_TASK_STATUSES as readonly string[]).includes(status);
}

export function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}

export function hoursSince(iso: string, now = new Date()): number {
  return Math.max(0, (now.getTime() - new Date(iso).getTime()) / 3_600_000);
}

export function summarizeInstructions(instructions: string | null, max = 140): string {
  if (!instructions) {
    return "";
  }
  const first = instructions.split(/(?<=\.)\s/)[0] ?? instructions;
  if (first.length <= max) {
    return first;
  }
  return `${first.slice(0, max - 1).trim()}…`;
}

export function isFollowUpDue(
  task: Pick<
    RankableTask,
    "status" | "nextFollowUpAt" | "lastContactedAt" | "followUpIntervalHours"
  >,
  now = new Date(),
): boolean {
  if (!isActiveTaskStatus(task.status)) {
    return false;
  }
  if (task.nextFollowUpAt) {
    return new Date(task.nextFollowUpAt).getTime() <= now.getTime();
  }
  if (task.lastContactedAt && task.followUpIntervalHours) {
    return (
      now.getTime() >=
      new Date(task.lastContactedAt).getTime() +
        task.followUpIntervalHours * 3_600_000
    );
  }
  return false;
}

export function isEscalationDue(
  task: Pick<
    RankableTask,
    | "status"
    | "escalationAfterHours"
    | "escalationLevel"
    | "waitingSince"
    | "lastContactedAt"
    | "createdAt"
  >,
  now = new Date(),
): boolean {
  if (!isActiveTaskStatus(task.status)) {
    return false;
  }
  if (task.escalationLevel && task.escalationLevel !== "none") {
    return true;
  }
  if (task.escalationAfterHours == null) {
    return false;
  }
  const start = task.waitingSince ?? task.lastContactedAt;
  if (!start) {
    return false;
  }
  return (
    now.getTime() >=
    new Date(start).getTime() + task.escalationAfterHours * 3_600_000
  );
}

export function isOverdue(
  task: Pick<RankableTask, "status" | "dueAt">,
  now = new Date(),
): boolean {
  if (!isActiveTaskStatus(task.status) || !task.dueAt) {
    return false;
  }
  return new Date(task.dueAt).getTime() < now.getTime();
}

export function waitingAgeHours(
  task: Pick<RankableTask, "status" | "waitingSince">,
  now = new Date(),
): number | null {
  if (task.status !== "waiting" || !task.waitingSince) {
    return null;
  }
  return hoursSince(task.waitingSince, now);
}

export function nextFollowUpAtFrom(
  fromIso: string,
  intervalHours: number | null,
): string | null {
  if (intervalHours == null || intervalHours <= 0) {
    return null;
  }
  return addHours(fromIso, intervalHours);
}

export function applyPlaybookContactRequirement(task: RankableTask): RankableTask {
  const playbook = task.playbookKey ? getPlaybook(task.playbookKey) : null;
  if (playbook) {
    return {
      ...task,
      requiresContact: playbook.requiresContact,
      expectedContactType: playbook.contactType ?? null,
    };
  }
  const inferred =
    task.sourceType != null && task.sourceType !== "internal";
  return {
    ...task,
    requiresContact: task.requiresContact ?? inferred,
    expectedContactType:
      task.expectedContactType ?? (inferred ? task.sourceType : null),
  };
}

export function isContactMissing(task: RankableTask): boolean {
  if (task.dealContactId) {
    return false;
  }
  return Boolean(task.requiresContact) || task.blockedReason === "contact_missing";
}

export function nextActionBand(
  task: RankableTask,
  now = new Date(),
): NextActionBand {
  if (isOverdue(task, now) || isEscalationDue(task, now)) {
    return "overdue_or_escalation";
  }
  if (task.timing === "required_now" && isContactMissing(task)) {
    return "required_now_blocked";
  }
  if (task.timing === "required_now") {
    return "required_now";
  }
  if (isFollowUpDue(task, now)) {
    return "follow_up_due";
  }
  if (task.taskKind === "review_document") {
    return "document_review";
  }
  if (task.timing === "required_later") {
    return "required_later";
  }
  return "optional";
}

export function rankNextActions(
  tasks: RankableTask[],
  now = new Date(),
): RankedNextAction[] {
  return tasks
    .filter((task) => isActiveTaskStatus(task.status))
    .map((task) => applyPlaybookContactRequirement(task))
    .map((task) => {
      const band = nextActionBand(task, now);
      return {
        ...task,
        rank: NEXT_ACTION_BANDS.indexOf(band) + 1,
        band,
        followUpDue: isFollowUpDue(task, now),
        escalationDue: isEscalationDue(task, now),
        overdue: isOverdue(task, now),
        contactMissing: isContactMissing(task),
        waitingAgeHours: waitingAgeHours(task, now),
        instructionsSummary: summarizeInstructions(task.instructions),
      };
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) {
        return a.rank - b.rank;
      }
      const priorityDelta =
        (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    });
}

export function instantiatePlaybook(
  playbook: PlaybookDefinition,
  options?: {
    timing?: TaskTiming;
    clientNeedId?: string | null;
    priority?: TaskPriority;
  },
): InstantiatedTask {
  return {
    playbookKey: playbook.playbookKey,
    title: playbook.title,
    taskType: playbook.taskKind,
    description: playbook.completionRule.summary,
    sourceType: playbook.sourceType,
    taskKind: playbook.taskKind,
    timing: options?.timing ?? playbook.timing,
    priority: options?.priority ?? playbook.priority,
    instructions: playbook.instructions,
    completionRule: playbook.completionRule.summary,
    followUpIntervalHours: playbook.followUpIntervalHours,
    escalationAfterHours: playbook.escalationAfterHours,
    escalationLevel: "none",
    clientNeedId: options?.clientNeedId ?? null,
  };
}

export function matchesClientNeed(
  need: { documentType: string; category: string },
  playbook: Pick<
    PlaybookDefinition,
    "needDocumentType" | "needMatchAliases" | "needCategory"
  >,
): boolean {
  const needles = [
    playbook.needDocumentType,
    ...(playbook.needMatchAliases ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  if (needles.length === 0) {
    return false;
  }
  const hay = `${need.documentType} ${need.category}`.toLowerCase();
  return needles.some(
    (needle) =>
      hay.includes(needle) ||
      need.documentType.toLowerCase().includes(needle) ||
      needle.includes(need.documentType.toLowerCase()),
  );
}

export function findMatchingClientNeed<
  T extends { id: string; documentType: string; category: string },
>(needs: T[], playbook: PlaybookDefinition): T | null {
  return needs.find((need) => matchesClientNeed(need, playbook)) ?? null;
}

export function resolveClientNeedForPlaybook(
  playbook: PlaybookDefinition,
  existingNeeds: { id: string; documentType: string; category: string }[],
): {
  clientNeedId: string | null;
  shouldCreateNeed: boolean;
  matchedNeedId: string | null;
} {
  const match = findMatchingClientNeed(existingNeeds, playbook);
  if (match) {
    return {
      clientNeedId: match.id,
      shouldCreateNeed: false,
      matchedNeedId: match.id,
    };
  }
  if (playbook.createsClientNeed && playbook.needDocumentType) {
    return {
      clientNeedId: null,
      shouldCreateNeed: true,
      matchedNeedId: null,
    };
  }
  return {
    clientNeedId: null,
    shouldCreateNeed: false,
    matchedNeedId: null,
  };
}

export function clientNeedInsertFromPlaybook(
  dealId: string,
  playbook: PlaybookDefinition,
): {
  deal_id: string;
  category: string;
  document_type: string;
  description: string;
  required: boolean;
  status: "missing";
  expected_document_count: number | null;
} {
  return {
    deal_id: dealId,
    category: playbook.needCategory ?? "Other",
    document_type: playbook.needDocumentType ?? playbook.title,
    description: playbook.title,
    required: playbook.alwaysRequired,
    status: "missing",
    expected_document_count: playbook.expectedDocumentCount ?? null,
  };
}

export function dealAlreadyHasPlaybookTask(
  tasks: { playbookKey: string | null; status: string }[],
  playbookKey: string,
): boolean {
  return tasks.some(
    (task) => task.playbookKey === playbookKey && task.status !== "dismissed",
  );
}

export function evaluateCompletionReadiness(input: {
  requiresLinkedNeed: boolean;
  requiresNeedApprovedOrAccepted: boolean;
  requiresDocumentLinked: boolean;
  requiresProcessorAccepted: boolean;
  linkedNeedStatus: string | null;
  hasLinkedDocument: boolean;
  processorAccepted: boolean;
}): {
  ready: boolean;
  autoUnderwrite: false;
  updatesClientNeedStatus: false;
  creditDecision: null;
  blockers: string[];
} {
  const blockers: string[] = [];
  if (input.requiresLinkedNeed && !input.linkedNeedStatus) {
    blockers.push("No linked Client Need.");
  }
  if (
    input.requiresNeedApprovedOrAccepted &&
    input.linkedNeedStatus &&
    input.linkedNeedStatus !== "approved" &&
    input.linkedNeedStatus !== "waived"
  ) {
    blockers.push("Linked Client Need is not approved or accepted.");
  }
  if (input.requiresDocumentLinked && !input.hasLinkedDocument) {
    blockers.push("Expected document is not linked.");
  }
  if (input.requiresProcessorAccepted && !input.processorAccepted) {
    blockers.push("Processor has not accepted completion.");
  }
  return {
    ready: blockers.length === 0,
    autoUnderwrite: false,
    updatesClientNeedStatus: false,
    creditDecision: null,
    blockers,
  };
}

export function applyTaskCompletion(): {
  autoUnderwrite: false;
  updatesClientNeedStatus: false;
  creditDecision: null;
} {
  return {
    autoUnderwrite: false,
    updatesClientNeedStatus: false,
    creditDecision: null,
  };
}

export function taskTimingGroup(
  task: Pick<RankableTask, "status" | "timing">,
): "required_now" | "required_later" | "optional" | "completed" {
  if (task.status === "completed" || task.status === "dismissed") {
    return "completed";
  }
  if (task.timing === "required_later") {
    return "required_later";
  }
  if (task.timing === "optional") {
    return "optional";
  }
  return "required_now";
}

export function escalationLabel(level: string | null, due: boolean): string {
  if (level === "loan_officer") {
    return "Escalated to LO";
  }
  if (level === "manager") {
    return "Escalated to manager";
  }
  if (level === "processor") {
    return "Escalated to processor";
  }
  if (due) {
    return "Escalate to LO";
  }
  return "None";
}

export function isEscalationLevelValue(value: string): value is EscalationLevel {
  return (
    value === "none" ||
    value === "processor" ||
    value === "loan_officer" ||
    value === "manager"
  );
}
