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
  deal_claimed: "Assigned the file",
  deal_unclaimed: "Unassigned the file",
  deal_status_changed: "Changed deal status",
  client_need_status_changed: "Updated Client Need",
  document_upload_session_created: "Started a document upload",
  document_metadata_recorded: "Uploaded a document",
  document_status_changed: "Updated document status",
  document_access_requested: "Requested temporary document access",
  document_linked: "Linked a document",
  task_started: "Started task",
  task_waiting: "Marked waiting",
  task_completed: "Completed task",
  task_dismissed: "Dismissed task",
  task_contacted: "Contacted",
  task_follow_up_set: "Follow-up scheduled",
  task_escalated: "Escalated",
  task_created: "Created task",
  baseline_tasks_generated: "Generated baseline tasks",
  contact_created: "Added contact",
  contact_updated: "Updated contact",
  contact_linked: "Linked contact",
  contact_marked: "Contacted",
  follow_up_scheduled: "Follow-up scheduled",
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
  if (metadata.kind === "condition") {
    if (eventType === "task_created") {
      return "added condition";
    }
    if (eventType === "task_completed") {
      return "cleared condition";
    }
    if (
      eventType === "task_contacted" ||
      eventType === "task_follow_up_set" ||
      eventType === "follow_up_scheduled"
    ) {
      return "followed up on condition";
    }
    if (
      eventType === "document_metadata_recorded" ||
      eventType === "document_linked" ||
      eventType === "response_received"
    ) {
      return "Document received for condition";
    }
  }
  if (
    eventType === "deal_status_changed" &&
    (metadata.kind === "submission" || metadata.to === "submitted")
  ) {
    return "marked file submitted";
  }
  if (eventType === "document_status_changed" && metadata.to === "rejected") {
    return "Document marked rejected";
  }
  if (eventType === "client_need_status_changed") {
    if (metadata.to === "rejected") {
      return "Document marked rejected";
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
    return "Contacted";
  }
  if (eventType === "response_received") {
    if (metadata.sandbox_simulated === "true") {
      return "Reply received (sandbox)";
    }
    return "Reply received";
  }
  if (eventType === "document_metadata_recorded") {
    return "Uploaded a document";
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
