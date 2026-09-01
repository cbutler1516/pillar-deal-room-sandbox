/** Presentation-only processor language. Does not change Queue Truth ranks. */

const REASON_EXACT: Record<string, string> = {
  "Replacement received": "Replacement ready for review",
  "Replacement needed": "Replacement still needed",
  "Replacement document ready for review": "Replacement ready for review",
  "Replacement document is still needed": "Replacement still needed",
  "Response received awaiting review": "Reply received — review needed",
  "Required task has not had initial contact": "No request has been sent yet",
  "Required item is missing": "Required document is still missing",
  "Active collection task": "Review file",
  "Escalation due": "Follow-up is overdue",
  "Follow-up is overdue — escalate": "Follow-up is overdue",
  "Ready to submit": "Ready to submit",
  "Near-ready file": "Almost ready to submit",
  "Waiting on a response": "Waiting on a reply",
  "Unassigned file": "New unassigned file",
  "New application": "New file",
  "Follow-up overdue": "Follow-up is overdue",
  "Document awaiting processor review": "New document ready for review",
  "Condition still outstanding": "Condition still outstanding",
  "Condition response received": "Condition response received",
  "Condition document needs review": "Condition document needs review",
  "Waiting on a condition response": "Waiting on a condition response",
};

export function humanizeWorkReason(reason: string): string {
  if (REASON_EXACT[reason]) {
    return REASON_EXACT[reason];
  }
  const noContact = reason.match(/^No initial contact with (.+)$/);
  if (noContact) {
    return `No request has been sent to ${noContact[1]} yet`;
  }
  const missingContact = reason.match(/^No (.+) contact$/);
  if (missingContact) {
    return `${capitalize(missingContact[1])} contact is missing`;
  }
  const replyFrom = reason.match(/^Response received from (.+)$/);
  if (replyFrom) {
    return `Reply received from ${replyFrom[1]} — review needed`;
  }
  const waitingOn = reason.match(/^Waiting on (.+)$/);
  if (waitingOn && waitingOn[1] !== "a response") {
    return `Waiting on ${waitingOn[1]}`;
  }
  const overdueBy = reason.match(/^Follow-up overdue by (.+)$/);
  if (overdueBy) {
    return `Follow-up is overdue by ${overdueBy[1]}`;
  }
  return stripReasonCtaEcho(reason);
}

const CONTACT_ROLES = [
  "borrower",
  "title",
  "insurance",
  "contractor",
  "cpa",
  "property manager",
] as const;

export function contactRoleFromText(value: string | null | undefined): string | null {
  const haystack = (value ?? "").toLowerCase();
  for (const role of CONTACT_ROLES) {
    if (haystack.includes(role)) {
      return role === "cpa" ? "CPA" : role;
    }
  }
  return null;
}

export function humanizeWorkAction(row: {
  recommendedAction: string;
  workType: string;
  title?: string | null;
  target?: string | null;
}): string {
  const action = row.recommendedAction.trim();
  const type = row.workType;

  if (type === "escalation_due") {
    return "Follow up";
  }
  if (type === "escalated_task") {
    return "Escalate";
  }
  if (type === "replacement_needed" || action === "Request replacement") {
    return "Get replacement";
  }
  if (
    type === "replacement_received" ||
    type === "document_awaiting_review" ||
    type === "document_duplicate" ||
    type === "document_mismatch"
  ) {
    return "Review document";
  }
  if (action === "Review condition" || row.target === "conditions") {
    if (action === "Follow up") {
      return "Follow up";
    }
    return "Review condition";
  }
  if (type === "response_received") {
    return "Review reply";
  }
  if (type === "required_need_missing" || action === "Collect") {
    return row.target === "needs" || !row.target ? "View requirement" : "Open file";
  }
  if (type === "unassigned_file" || action === "Claim") {
    return "Claim file";
  }
  if (type === "new_application" && action === "Open") {
    return "Open file";
  }
  if (action === "Open") {
    return row.target === "documents" || row.target === "tasks"
      ? "Review file"
      : "Open file";
  }
  if (action === "Add contact") {
    return "Add contact";
  }
  if (action === "Contact") {
    const role = contactRoleFromText(row.title);
    return role ? `Contact ${role}` : "Contact";
  }
  if (action === "Review") {
    if (row.target === "tasks") {
      return "Review task";
    }
    return "Review document";
  }
  if (action === "Follow up") {
    return "Follow up";
  }
  if (action === "Escalate") {
    return "Follow up";
  }
  return action;
}

export function stripReasonCtaEcho(reason: string, actionLabel?: string): string {
  let next = reason
    .replace(/\s*[—–-]\s*escalate$/i, "")
    .replace(/\s+escalate$/i, "")
    .trim();
  const action = actionLabel?.replace(/→/g, "").trim();
  if (action && action.length > 2) {
    next = next
      .replace(new RegExp(`\\s*[—–-]\\s*${escapeRegExp(action)}$`, "i"), "")
      .trim();
  }
  return next;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function polishAssistSummary(summary: string): string {
  return summary
    .replace(/\bfile in new\b/gi, "new file")
    .replace(/\bfile in processor review\b/gi, "file in processor review")
    .replace(/\bfile in collecting documents\b/gi, "file collecting documents")
    .replace(/\bThis is an assistive summary\. It does not change the file\./gi, "")
    .replace(/\brequest replacement\b/gi, "get a replacement document")
    .replace(/\bRequest replacement\b/g, "Get a replacement document")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
