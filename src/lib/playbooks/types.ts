export const SOURCE_TYPES = [
  "borrower",
  "title",
  "insurance",
  "escrow",
  "closing_attorney",
  "appraiser",
  "contractor",
  "property_manager",
  "cpa",
  "lender",
  "internal",
  "other",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const TASK_KINDS = [
  "request_document",
  "request_information",
  "review_document",
  "verify_information",
  "contact_third_party",
  "follow_up",
  "prepare_submission",
  "resolve_exception",
  "internal_review",
  "other",
] as const;

export type TaskKind = (typeof TASK_KINDS)[number];

export const TASK_TIMINGS = ["required_now", "required_later", "optional"] as const;

export type TaskTiming = (typeof TASK_TIMINGS)[number];

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const PLAYBOOK_TASK_STATUSES = [
  "open",
  "in_progress",
  "waiting",
  "completed",
  "dismissed",
] as const;

export type PlaybookTaskStatus = (typeof PLAYBOOK_TASK_STATUSES)[number];

export const ESCALATION_LEVELS = [
  "none",
  "processor",
  "loan_officer",
  "manager",
] as const;

export type EscalationLevel = (typeof ESCALATION_LEVELS)[number];

export type CompletionRule = {
  key: string;
  summary: string;
  requiresLinkedNeed: boolean;
  requiresNeedApprovedOrAccepted: boolean;
  requiresDocumentLinked: boolean;
  requiresProcessorAccepted: boolean;
  autoUnderwrite: false;
};

export type PlaybookDefinition = {
  playbookKey: string;
  title: string;
  sourceType: SourceType;
  taskKind: TaskKind;
  timing: TaskTiming;
  priority: TaskPriority;
  instructions: string;
  completionRule: CompletionRule;
  followUpIntervalHours: number | null;
  escalationAfterHours: number | null;
  createsClientNeed: boolean;
  alwaysRequired: boolean;
  requiresContact: boolean;
  contactType?: import("@/lib/contacts/types").ContactType;
  requestTemplate?: string;
  requestSummary?: string;
  needCategory?: string;
  needDocumentType?: string;
  needMatchAliases?: string[];
  expectedDocumentCount?: number | null;
};

export type InstantiatedTask = {
  playbookKey: string;
  title: string;
  taskType: string;
  description: string;
  sourceType: SourceType;
  taskKind: TaskKind;
  timing: TaskTiming;
  priority: TaskPriority;
  instructions: string;
  completionRule: string;
  followUpIntervalHours: number | null;
  escalationAfterHours: number | null;
  escalationLevel: EscalationLevel;
  clientNeedId: string | null;
};

export function isSourceType(value: string): value is SourceType {
  return (SOURCE_TYPES as readonly string[]).includes(value);
}

export function isTaskKind(value: string): value is TaskKind {
  return (TASK_KINDS as readonly string[]).includes(value);
}

export function isTaskTiming(value: string): value is TaskTiming {
  return (TASK_TIMINGS as readonly string[]).includes(value);
}

export function isPlaybookTaskStatus(value: string): value is PlaybookTaskStatus {
  return (PLAYBOOK_TASK_STATUSES as readonly string[]).includes(value);
}

export function isEscalationLevel(value: string): value is EscalationLevel {
  return (ESCALATION_LEVELS as readonly string[]).includes(value);
}
