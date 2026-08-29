import type { UserRole } from "@/lib/auth/roles";
import { isAdmin, isProcessor } from "@/lib/auth/roles";

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

export function canClaimDeal(
  assignedProcessorId: string | null,
  userId: string,
  role: UserRole,
): boolean {
  if (isAdmin(role)) {
    return assignedProcessorId == null || assignedProcessorId === userId;
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
