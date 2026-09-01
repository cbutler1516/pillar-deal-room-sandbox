import type {
  AIDealSnapshot,
  AIDraftRewriteRequest,
  AIDraftRewriteResult,
  AINextActionSuggestion,
  AIProvider,
  AISummaryRequest,
  AISummaryResult,
  AIWorkflowFlag,
} from "@/lib/ai/types";
import { AI_ASSIST_DISCLAIMER, SANDBOX_MOCK_AI_PROVIDER } from "@/lib/ai/types";

const COMPLETE_NEED = new Set(["approved", "waived"]);
const OPEN_TASK = new Set(["open", "in_progress", "waiting"]);
const FORBIDDEN_REWRITE =
  /\b(approved|creditworth\w*|interest rate|lender selected|i('ll| will) send|wire|ssn|social security|account number)\b/gi;
const RATE_PROMISE = /\b\d+(\.\d+)?\s*%/g;

function href(dealId: string, tab: AINextActionSuggestion["target"]): string {
  if (tab === "overview") {
    return `/deals/${dealId}`;
  }
  return `/deals/${dealId}?tab=${tab}`;
}

function missingItems(snapshot: AIDealSnapshot): string[] {
  return snapshot.needs
    .filter((need) => need.required && !COMPLETE_NEED.has(need.status))
    .map((need) =>
      need.status === "rejected"
        ? `Replacement needed: ${need.documentType}`
        : `${need.documentType} (${need.status.replaceAll("_", " ")})`,
    );
}

function buildFlags(snapshot: AIDealSnapshot): AIWorkflowFlag[] {
  const flags: AIWorkflowFlag[] = [];
  const requiredIncomplete = snapshot.needs.filter(
    (need) => need.required && !COMPLETE_NEED.has(need.status),
  );
  for (const need of requiredIncomplete.filter((item) => item.status === "rejected")) {
    flags.push({
      kind: "replacement",
      severity: "blocker",
      title: "Replacement needed",
      detail: `${need.documentType} was rejected and still needs a borrower-safe replacement request.`,
    });
  }
  for (const task of snapshot.tasks) {
    if (task.contactMissing && OPEN_TASK.has(task.status)) {
      flags.push({
        kind: "no_contact",
        severity: "blocker",
        title: "Missing contact",
        detail: `${task.title} is blocked until a contact is added.`,
      });
    }
    if (task.escalationDue && OPEN_TASK.has(task.status)) {
      flags.push({
        kind: "stale",
        severity: "blocker",
        title: "Escalation due",
        detail: `${task.title} is past the escalation window.`,
      });
    } else if (task.followUpDue && OPEN_TASK.has(task.status)) {
      flags.push({
        kind: "stale",
        severity: "warning",
        title: "Follow-up overdue",
        detail: `${task.title} has an overdue follow-up.`,
      });
    }
    if (task.status === "waiting" && task.lastResponseAt) {
      flags.push({
        kind: "conflict",
        severity: "warning",
        title: "Waiting after a recorded response",
        detail: `${task.title} is still waiting even though a response was recorded. Review it; do not auto-complete.`,
      });
    }
    if (
      task.status === "completed" &&
      task.clientNeedId &&
      snapshot.needs.some(
        (need) =>
          need.id === task.clientNeedId &&
          need.required &&
          need.status === "rejected",
      )
    ) {
      flags.push({
        kind: "conflict",
        severity: "warning",
        title: "Completed task with a rejected Need",
        detail: `${task.title} is complete, but the linked Client Need still needs a replacement.`,
      });
    }
  }
  for (const need of snapshot.needs) {
    const receivedDoc = snapshot.documents.some(
      (doc) =>
        (doc.documentType === need.documentType && doc.status === "needs_review") ||
        doc.status === "needs_review",
    );
    if (need.status === "requested" && receivedDoc && need.required) {
      flags.push({
        kind: "review",
        severity: "info",
        title: "Document waiting on Need status",
        detail: `${need.documentType} has a document in review while the Need is still requested.`,
      });
    }
  }
  if (snapshot.communications.some((item) => item.sandboxSimulated)) {
    flags.push({
      kind: "simulated",
      severity: "info",
      title: "Sandbox simulated response on file",
      detail:
        "A SANDBOX — Simulated response was recorded. It is not a real external message.",
    });
  }
  if (requiredIncomplete.length > 0 && flags.every((flag) => flag.kind !== "missing_item")) {
    flags.push({
      kind: "missing_item",
      severity: "warning",
      title: "Required items still open",
      detail: `${requiredIncomplete.length} required Client Need${
        requiredIncomplete.length === 1 ? "" : "s"
      } are incomplete.`,
    });
  }
  return flags;
}

function buildNextActions(snapshot: AIDealSnapshot): AINextActionSuggestion[] {
  const suggestions: AINextActionSuggestion[] = [];
  const replacement = snapshot.needs.find(
    (need) => need.required && need.status === "rejected",
  );
  if (replacement) {
    suggestions.push({
      action: `Request replacement ${replacement.documentType} from borrower`,
      reason: "A required Client Need is marked replacement needed.",
      target: "needs",
      href: href(snapshot.dealId, "needs"),
      executable: false,
    });
  }
  const escalate = snapshot.tasks.find(
    (task) => task.escalationDue && OPEN_TASK.has(task.status) && !task.contactMissing,
  );
  if (escalate) {
    suggestions.push({
      action: `Escalate ${escalate.title.toLowerCase()}`,
      reason: "The follow-up window has passed.",
      target: "tasks",
      href: href(snapshot.dealId, "tasks"),
      executable: false,
    });
  }
  const followUp = snapshot.tasks.find(
    (task) => task.followUpDue && OPEN_TASK.has(task.status) && !task.contactMissing,
  );
  if (followUp && followUp.id !== escalate?.id) {
    suggestions.push({
      action: followUp.contactName
        ? `Follow up with ${followUp.contactName} for ${followUp.title.toLowerCase()}`
        : `Follow up on ${followUp.title.toLowerCase()}`,
      reason: "Follow-up is overdue. Copy a draft; nothing is sent automatically.",
      target: "tasks",
      href: href(snapshot.dealId, "tasks"),
      executable: false,
    });
  }
  const review = snapshot.documents.find((doc) => doc.status === "needs_review");
  const receivedNeed = snapshot.needs.find(
    (need) => need.status === "received" || need.status === "needs_review",
  );
  if (review || receivedNeed) {
    suggestions.push({
      action: `Review newly received ${(review?.documentType ?? receivedNeed?.documentType ?? "documents").toLowerCase()}`,
      reason: "A processor still has to accept or request a replacement.",
      target: "documents",
      href: href(snapshot.dealId, "documents"),
      executable: false,
    });
  }
  const missingContact = snapshot.tasks.find(
    (task) => task.contactMissing && OPEN_TASK.has(task.status),
  );
  if (missingContact) {
    suggestions.push({
      action: `Add a contact for ${missingContact.title.toLowerCase()}`,
      reason: "The task is blocked on a missing contact.",
      target: "contacts",
      href: href(snapshot.dealId, "contacts"),
      executable: false,
    });
  }
  const initial = snapshot.tasks.find(
    (task) =>
      OPEN_TASK.has(task.status) &&
      !task.lastContactedAt &&
      !task.contactMissing,
  );
  if (initial && suggestions.length < 4) {
    suggestions.push({
      action: initial.contactName
        ? `Send initial request to ${initial.contactName} for ${initial.title.toLowerCase()}`
        : `Copy the initial request for ${initial.title.toLowerCase()}`,
      reason: "No contact has been recorded. Copy only.",
      target: "tasks",
      href: href(snapshot.dealId, "tasks"),
      executable: false,
    });
  }
  return suggestions.slice(0, 4);
}

function dealSummary(snapshot: AIDealSnapshot): string {
  const required = snapshot.needs.filter((need) => need.required);
  const complete = required.filter((need) => COMPLETE_NEED.has(need.status)).length;
  const waiting = snapshot.tasks.filter((task) => task.status === "waiting").length;
  const assigned = snapshot.assignedProcessorId
    ? "A processor owns this file."
    : "This file is unassigned.";
  const status =
    snapshot.status === "new"
      ? "This is a new file"
      : snapshot.status === "collecting_documents"
        ? "This file is collecting documents"
        : snapshot.status === "processor_review"
          ? "This file is in processor review"
          : `This file is ${snapshot.status.replaceAll("_", " ")}`;
  return [
    `${status} (${snapshot.loanType ?? "business-purpose"}).`,
    `${complete} of ${required.length} required items are accepted or waived.`,
    waiting === 0
      ? "Nothing is waiting on a reply."
      : `${waiting} item${waiting === 1 ? " is" : "s are"} waiting on a reply.`,
    assigned,
  ].join(" ");
}

function communicationSummary(snapshot: AIDealSnapshot): string {
  if (snapshot.communications.length === 0) {
    return "No communication attempts are on this file yet. Nothing has been sent.";
  }
  const contacted = snapshot.communications.filter((item) => item.status === "contacted").length;
  const simulated = snapshot.communications.filter((item) => item.sandboxSimulated).length;
  const copied = snapshot.communications.filter((item) => item.status === "copied").length;
  const parts = [
    `${snapshot.communications.length} communication record${
      snapshot.communications.length === 1 ? "" : "s"
    } are on the ledger.`,
    `${contacted} marked contacted, ${copied} copied drafts.`,
    "outbound_sent is false on every row.",
  ];
  if (simulated > 0) {
    parts.push(
      `${simulated} SANDBOX simulated response${simulated === 1 ? "" : "s"} — not a real inbound message.`,
    );
  }
  return parts.join(" ");
}

function blockerSummary(flags: AIWorkflowFlag[], missing: string[]): string {
  const blockers = flags.filter((flag) => flag.severity === "blocker");
  if (blockers.length === 0 && missing.length === 0) {
    return "No current blockers. Continue the next processor action.";
  }
  const titles = blockers.map((flag) => flag.title);
  if (missing.length > 0 && !titles.includes("Required items still open")) {
    titles.push("Required items still open");
  }
  return `Blockers: ${titles.join("; ") || missing.join("; ")}.`;
}

function recentChanges(snapshot: AIDealSnapshot): string {
  const events = [...snapshot.activity]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 5)
    .map((event) => event.eventType.replaceAll("_", " "));
  const comms = [...snapshot.communications]
    .sort((a, b) => (a.attemptedAt < b.attemptedAt ? 1 : -1))
    .slice(0, 3)
    .map((item) =>
      item.sandboxSimulated
        ? "sandbox simulated response"
        : `${item.status} ${item.channel}`,
    );
  if (events.length === 0 && comms.length === 0) {
    return "Nothing has changed on this file yet.";
  }
  const parts: string[] = [];
  if (events.length > 0) {
    parts.push(`Recent activity: ${events.join(", ")}.`);
  }
  if (comms.length > 0) {
    parts.push(`Recent communications: ${comms.join(", ")}.`);
  }
  return parts.join(" ");
}

function stripForbidden(text: string): string {
  return text
    .replace(FORBIDDEN_REWRITE, "")
    .replace(RATE_PROMISE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function hadForbiddenClaims(text: string): boolean {
  return (
    /\b(approved|creditworth\w*|interest rate|lender selected|i('ll| will) send|wire|ssn|social security|account number)\b/i.test(
      text,
    ) || /\b\d+(\.\d+)?\s*%/.test(text)
  );
}

function rewriteBody(request: AIDraftRewriteRequest): string {
  const intent = request.intent ?? "clarify";
  const opener =
    intent === "replacement"
      ? "The document we received cannot be used. Please send a replacement that matches the request."
      : intent === "follow_up"
        ? "Following up on our earlier request."
        : intent === "shorten"
          ? ""
          : "Please send the item below so we can keep this file moving.";
  const cleaned = stripForbidden(request.currentBody)
    .replace(/^Hi [^,\n]+,\s*/i, "")
    .replace(/^Hello,?\s*/i, "")
    .replace(/Thank you[^\n]*$/i, "")
    .trim();
  const body = stripForbidden([opener, cleaned].filter(Boolean).join(" "));
  const withDisclaimer = `${body} ${AI_ASSIST_DISCLAIMER}`.trim();
  if (request.channel === "sms") {
    return withDisclaimer.slice(0, 240);
  }
  if (request.channel === "phone") {
    return `Call the contact. ${body} Do not collect secrets on the call. ${AI_ASSIST_DISCLAIMER}`;
  }
  return withDisclaimer;
}

export function getSandboxMockAIProvider(): AIProvider {
  return {
    name: SANDBOX_MOCK_AI_PROVIDER,
    async summarize(request: AISummaryRequest): Promise<AISummaryResult> {
      const flags = buildFlags(request.snapshot);
      const missing = missingItems(request.snapshot);
      return {
        provider: SANDBOX_MOCK_AI_PROVIDER,
        engine: "deterministic",
        dealSummary: dealSummary(request.snapshot),
        communicationSummary: communicationSummary(request.snapshot),
        missingItems: missing,
        blockerSummary: blockerSummary(flags, missing),
        nextActions: buildNextActions(request.snapshot),
        flags,
        recentChanges: recentChanges(request.snapshot),
        executable: false,
        canMutateWorkflow: false,
      };
    },
    async rewriteDraft(
      request: AIDraftRewriteRequest,
    ): Promise<AIDraftRewriteResult> {
      const original = `${request.currentSubject ?? ""}\n${request.currentBody}`;
      const flags: AIWorkflowFlag[] = [];
      if (hadForbiddenClaims(original)) {
        flags.push({
          kind: "rewrite_guard",
          severity: "warning",
          title: "Forbidden claims removed",
          detail:
            "The rewrite stripped approval, credit, rate, lender, send, or secret language. A processor still has to copy anything they use.",
        });
      }
      const subject = stripForbidden(
        request.currentSubject || `${request.snapshot.dealReference}: Request`,
      );
      return {
        provider: SANDBOX_MOCK_AI_PROVIDER,
        engine: "deterministic",
        subject,
        body: rewriteBody(request),
        disclaimer: AI_ASSIST_DISCLAIMER,
        flags,
        outboundSent: false,
        executable: false,
      };
    },
  };
}
