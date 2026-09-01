/** Presentation-only processor language. Does not change Queue Truth ranks. */

const REASON_EXACT: Record<string, string> = {
  "Replacement received": "Replacement document ready for review",
  "Replacement needed": "Replacement document is still needed",
  "Response received awaiting review": "Reply received — review needed",
  "Required task has not had initial contact": "No request has been sent yet",
  "Required item is missing": "Required document is still missing",
  "Active collection task": "Open work on this file",
  "Escalation due": "Follow-up is overdue — escalate",
  "Ready to submit": "Ready to submit",
  "Near-ready file": "Almost ready to submit",
  "Waiting on a response": "Waiting on a reply",
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
  return reason;
}

export function polishAssistSummary(summary: string): string {
  return summary
    .replace(/\bfile in new\b/gi, "new file")
    .replace(/\bfile in processor review\b/gi, "file in processor review")
    .replace(/\bfile in collecting documents\b/gi, "file collecting documents")
    .replace(/\bThis is an assistive summary\. It does not change the file\./gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
