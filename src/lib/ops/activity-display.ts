import {
  formatInStaffZone,
  formatStatusLabel,
  parseStaffInstant,
  staffCalendarDate,
} from "@/lib/format";

export type ActivityDisplayInput = {
  eventType: string;
  actorType: string;
  actorId?: string | null;
  createdAt: string;
  safeMetadata: Record<string, string>;
};

export type ActivityDisplay = {
  who: string;
  didWhat: string;
  toWhat: string | null;
  when: string;
};

const EVENT_ACTIONS: Record<string, string> = {
  application_received: "Received application",
  deal_claimed: "Claimed the deal",
  deal_unclaimed: "Unclaimed the deal",
  deal_status_changed: "Changed deal status",
  client_need_status_changed: "Updated Client Need",
  document_upload_session_created: "Started a document upload",
  document_metadata_recorded: "Recorded document metadata",
  document_status_changed: "Updated document status",
  document_access_requested: "Requested temporary document access",
  document_linked: "Linked a document",
  task_started: "Started task",
  task_waiting: "Marked waiting",
  task_completed: "Completed task",
  task_dismissed: "Dismissed task",
  task_contacted: "Marked contacted",
  task_follow_up_set: "Set follow-up",
  task_escalated: "Escalated",
  task_created: "Created task",
  baseline_tasks_generated: "Generated baseline tasks",
  contact_created: "Added contact",
  contact_updated: "Updated contact",
  contact_linked: "Linked contact",
  contact_marked: "Marked contacted",
  follow_up_scheduled: "Set follow-up",
  escalation_triggered: "Escalated",
  response_received: "Recorded a response",
  communication_draft_copied: "Copied a communication draft",
  portal_message_created: "Copied a portal message",
  ai_assist_requested: "Requested AI assist",
};

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function activityActorName(
  event: Pick<ActivityDisplayInput, "actorType" | "actorId">,
  names: Record<string, string> = {},
): string {
  if (event.actorType === "system" || event.actorType === "service") {
    return "System";
  }
  if (event.actorId && names[event.actorId]) {
    return names[event.actorId];
  }
  if (event.actorType === "user") {
    return "Staff";
  }
  return "System";
}

function targetFromMetadata(metadata: Record<string, string>): string | null {
  const target =
    metadata.document_type ??
    metadata.client_need ??
    metadata.need ??
    metadata.filename ??
    metadata.contact_name ??
    metadata.title ??
    metadata.task ??
    metadata.to ??
    null;
  if (!target) {
    return null;
  }
  if (metadata.from && metadata.to && !metadata.document_type && !metadata.filename) {
    return `${formatStatusLabel(metadata.from)} → ${formatStatusLabel(metadata.to)}`;
  }
  return target;
}

export function formatActivityAction(
  eventType: string,
  metadata: Record<string, string>,
): string {
  if (eventType === "client_need_status_changed") {
    if (metadata.to === "rejected") {
      return "Requested replacement";
    }
    if (metadata.to === "approved") {
      return "Approved";
    }
    if (metadata.to === "waived") {
      return "Waived";
    }
    if (metadata.to === "received" || metadata.to === "needs_review") {
      return "Marked received";
    }
    return "Updated Client Need";
  }
  if (eventType === "task_escalated") {
    const level = metadata.to ?? metadata.escalation_level ?? "loan officer";
    return `Escalated to ${titleCase(level).replace("Loan Officer", "Loan Officer")}`;
  }
  if (eventType === "contact_created" || eventType === "contact_linked") {
    const type = metadata.contact_type ?? metadata.type;
    return type ? `Linked ${titleCase(type)} contact` : "Linked contact";
  }
  if (eventType === "task_contacted" || eventType === "contact_marked") {
    return "Marked contacted";
  }
  if (eventType === "response_received") {
    if (metadata.sandbox_simulated === "true") {
      return "Recorded a sandbox simulated response";
    }
    return "Recorded a response";
  }
  if (eventType === "document_metadata_recorded") {
    return "Recorded uploaded document";
  }
  if (eventType === "ai_assist_requested") {
    if (metadata.capability === "rewrite_communication") {
      return "Requested an AI rewrite suggestion";
    }
    return "Requested AI assist";
  }
  return EVENT_ACTIONS[eventType] ?? titleCase(eventType);
}

export function formatActivityClock(iso: string, now = new Date()): string {
  const date = parseStaffInstant(iso);
  const current = parseStaffInstant(now);
  if (!date || !current) {
    return "—";
  }
  const sameDay = staffCalendarDate(date) === staffCalendarDate(current);
  return formatInStaffZone(date, {
    hour: "numeric",
    minute: "2-digit",
    ...(sameDay ? {} : { month: "short", day: "numeric" }),
  });
}

export function formatActivityDisplay(
  event: ActivityDisplayInput,
  names: Record<string, string> = {},
  now = new Date(),
): ActivityDisplay {
  return {
    who: activityActorName(event, names),
    didWhat: formatActivityAction(event.eventType, event.safeMetadata),
    toWhat: targetFromMetadata(event.safeMetadata),
    when: formatActivityClock(event.createdAt, now),
  };
}
