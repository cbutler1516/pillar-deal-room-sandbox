import type { UserRole } from "@/lib/auth/roles";
import { isAdmin, isProcessor } from "@/lib/auth/roles";
import { CONTACT_MISSING } from "@/lib/contacts/types";

export const DEAL_STATUSES = [
  "new",
  "application_in_progress",
  "collecting_documents",
  "processor_review",
  "missing_items",
  "ready_for_submission",
  "submitted",
  "closed",
  "withdrawn",
] as const;

export const NEED_STATUSES = [
  "missing",
  "requested",
  "received",
  "needs_review",
  "approved",
  "rejected",
  "waived",
] as const;

export const DOCUMENT_STATUSES = [
  "received",
  "classifying",
  "needs_review",
  "approved",
  "rejected",
] as const;

export const TASK_MUTATIONS = [
  "in_progress",
  "waiting",
  "completed",
  "dismissed",
] as const;

export const TASK_STATUS_EVENTS: Record<(typeof TASK_MUTATIONS)[number], string> =
  {
    in_progress: "task_started",
    waiting: "task_waiting",
    completed: "task_completed",
    dismissed: "task_dismissed",
  };

export function canMutateWorkflow(role: UserRole): boolean {
  return isAdmin(role) || isProcessor(role);
}

export function isDealOwnedByUser(
  assignedProcessorId: string | null,
  userId: string,
): boolean {
  return assignedProcessorId != null && assignedProcessorId === userId;
}

export function canClaimDeal(
  assignedProcessorId: string | null,
  userId: string,
  role: UserRole,
): boolean {
  if (isDealOwnedByUser(assignedProcessorId, userId)) {
    return false;
  }
  if (isAdmin(role)) {
    return assignedProcessorId == null;
  }
  if (!isProcessor(role)) {
    return false;
  }
  return assignedProcessorId == null;
}

export function canUnclaimDeal(
  assignedProcessorId: string | null,
  userId: string,
  role: UserRole,
): boolean {
  if (isAdmin(role)) {
    return assignedProcessorId != null;
  }
  if (!isProcessor(role)) {
    return false;
  }
  return assignedProcessorId === userId;
}

export type SubmissionNeed = {
  required: boolean;
  status: string;
  documentType?: string | null;
  timing?: string | null;
  requiredBeforeSubmission?: boolean;
};

export type SubmissionTask = {
  status: string;
  blockedReason: string | null;
  timing?: string | null;
  blocksSubmission?: boolean;
};

export type ReadinessAttention = {
  kind: "incomplete" | "replacement" | "missing_contact" | "blocking_task";
  label: string;
};

export type SubmissionReadiness = {
  ready: boolean;
  blockers: string[];
  satisfiedCount: number;
  requiredCount: number;
  attention: ReadinessAttention[];
};

export function needRequiredBeforeSubmission(need: SubmissionNeed): boolean {
  if (need.requiredBeforeSubmission === false) {
    return false;
  }
  if (need.requiredBeforeSubmission === true) {
    return true;
  }
  if (!need.required) {
    return false;
  }
  if (need.timing === "optional" || need.timing === "required_later") {
    return false;
  }
  return true;
}

function isOpenBlockingTask(task: SubmissionTask): boolean {
  const open =
    task.status === "open" ||
    task.status === "in_progress" ||
    task.status === "waiting";
  if (!open) {
    return false;
  }
  if (task.blocksSubmission === false) {
    return false;
  }
  if (task.blockedReason === CONTACT_MISSING) {
    return task.timing !== "optional" && task.timing !== "required_later";
  }
  return Boolean(task.blocksSubmission);
}

export function evaluateSubmissionReadiness(input: {
  needs: SubmissionNeed[];
  tasks?: SubmissionTask[];
}): SubmissionReadiness {
  const required = input.needs.filter(needRequiredBeforeSubmission);
  const satisfied = required.filter(
    (need) => need.status === "approved" || need.status === "waived",
  );
  const incomplete = required.filter(
    (need) => need.status !== "approved" && need.status !== "waived",
  );
  const replacements = required.filter((need) => need.status === "rejected");
  const missingContacts = (input.tasks ?? []).filter(isOpenBlockingTask);
  const attention: ReadinessAttention[] = [];
  const blockers: string[] = [];

  if (incomplete.length > 0) {
    const label = `${incomplete.length} required Need${incomplete.length === 1 ? "" : "s"} incomplete`;
    attention.push({ kind: "incomplete", label });
    blockers.push(label);
  }
  for (const need of replacements) {
    const label = need.documentType
      ? `Replacement needed: ${need.documentType}`
      : "Replacement needed on a required Client Need";
    attention.push({ kind: "replacement", label });
    blockers.push(label);
  }
  if (missingContacts.length > 0) {
    const label = `${missingContacts.length} missing contact${missingContacts.length === 1 ? "" : "s"}`;
    attention.push({ kind: "missing_contact", label });
    blockers.push("Required contacts are still missing.");
  }
  const extraBlocking = (input.tasks ?? []).filter(
    (task) =>
      isOpenBlockingTask(task) && task.blockedReason !== CONTACT_MISSING,
  );
  if (extraBlocking.length > 0) {
    const label = `${extraBlocking.length} open blocking task${extraBlocking.length === 1 ? "" : "s"}`;
    attention.push({ kind: "blocking_task", label });
    blockers.push(label);
  }

  return {
    ready: blockers.length === 0,
    blockers,
    satisfiedCount: satisfied.length,
    requiredCount: required.length,
    attention,
  };
}

export function canProcessorTouchAssignment(
  currentAssignedId: string | null,
  nextAssignedId: string | null,
  userId: string,
): boolean {
  if (currentAssignedId != null && currentAssignedId !== userId) {
    return false;
  }
  if (nextAssignedId != null && nextAssignedId !== userId) {
    return false;
  }
  return true;
}

export type ActivityEvent = {
  eventType: string;
  actorType: "user" | "system" | "service";
  actorId: string | null;
  safeMetadata: Record<string, string>;
};

const BLOCKED_METADATA_KEYS = [
  "ssn",
  "account_number",
  "external_file_id",
  "storage_provider",
  "raw_text",
  "password",
  "token",
  "secret",
  "upload_url",
  "access_url",
  "authorization",
  "bearer",
  "upload_token",
  "access_token",
  "provider_secret",
  "api_key",
  "session_token",
  "refresh_token",
  "client_secret",
  "chunk_uri",
  "download_url",
];

const BLOCKED_METADATA_FRAGMENTS = [
  "token",
  "secret",
  "password",
  "authorization",
  "api_key",
];

function isBlockedMetadataKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (BLOCKED_METADATA_KEYS.includes(normalized)) {
    return true;
  }
  return BLOCKED_METADATA_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment),
  );
}

export function sanitizeActivityMetadata(
  input: Record<string, unknown>,
): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isBlockedMetadataKey(key)) {
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      safe[key] = value.trim().slice(0, 120);
    }
  }
  return safe;
}

export function buildActivityEvent(input: {
  eventType: string;
  actorId: string;
  metadata?: Record<string, unknown>;
}): ActivityEvent {
  return {
    eventType: input.eventType,
    actorType: "user",
    actorId: input.actorId,
    safeMetadata: sanitizeActivityMetadata(input.metadata ?? {}),
  };
}
