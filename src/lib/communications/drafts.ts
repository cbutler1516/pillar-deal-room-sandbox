import type {
  CommunicationAudience,
  CommunicationChannel,
  CommunicationDraft,
  DraftType,
} from "@/lib/communications/types";
import {
  hasUnresolvedPlaybookPlaceholder,
  renderRequestTemplate,
  type RequestTemplateContext,
} from "@/lib/playbooks/templates";

const BLOCKED_SECRET_WORDS =
  /\b(ssn|social security|account number|routing number|password|secret|api[_-]?key|access[_-]?token|bearer)\b/i;
const BLOCKED_SECRET_VALUES =
  /\b\d{3}-\d{2}-\d{4}\b|\b(?:sk|pk|rk)_[A-Za-z0-9]{16,}\b/i;

export type DraftContext = RequestTemplateContext & {
  client_need?: string | number | null;
  requested_items?: string | number | null;
  due_context?: string | number | null;
  follow_up_context?: string | number | null;
  processor_name?: string | number | null;
};

const DRAFT_OPENERS: Record<DraftType, string> = {
  initial: "",
  follow_up: "Following up on our earlier request.",
  second_follow_up: "Second follow-up: we still need this item to keep the file moving.",
  escalation:
    "This request is overdue. Please treat it as time-sensitive so we can avoid an internal escalation.",
  replacement:
    "The document we received cannot be used. Please send a replacement that matches the request.",
  thank_you:
    "Thank you. We received your response and are reviewing it. This does not complete the requirement.",
};

const PORTAL_OPENERS: Record<DraftType, string> = {
  initial: "",
  follow_up: "Friendly reminder: we still need the item below.",
  second_follow_up: "We still need the item below to keep your file moving.",
  escalation: "This item is overdue. Please send it as soon as you can.",
  replacement:
    "The document we received cannot be used. Please upload a replacement that matches the request.",
  thank_you:
    "Thank you. We received your response and are reviewing it. You do not need to do anything else unless we ask.",
};

function stripBlockedSecrets(text: string): string {
  return text
    .replace(BLOCKED_SECRET_VALUES, "")
    .replace(BLOCKED_SECRET_WORDS, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function tidy(text: string): string {
  return stripBlockedSecrets(
    text
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.;:])/g, "$1")
      .replace(/^\s*[,.;:]\s*/g, "")
      .trim(),
  );
}

function joinSentences(...parts: Array<string | null | undefined>): string {
  return tidy(parts.filter((part) => part && part.trim()).join(" "));
}

function firstSentence(text: string, max = 160): string {
  const first = text.split(/(?<=\.)\s/)[0] ?? text;
  if (first.length <= max) {
    return first.trim();
  }
  return `${first.slice(0, max - 1).trim()}…`;
}

function talkingPoints(body: string, contactName: string | null): string {
  const who = contactName?.trim() || "the contact";
  return [
    `Call ${who}.`,
    firstSentence(body, 180),
    "Confirm they received the request and when we should expect a response.",
    "Do not collect SSNs, account numbers, passwords, or other secrets on the call.",
  ].join(" ");
}

export function sanitizeDraftText(text: string): string {
  const stripped = tidy(text);
  if (hasUnresolvedPlaybookPlaceholder(stripped)) {
    return tidy(stripped.replace(/(\{\{\s*[a-z_]+\s*\}\}|\$\{\s*[a-z_]+\s*\}|\[[a-z_]+\])/gi, ""));
  }
  return stripped;
}

export function hasBlockedSecrets(text: string): boolean {
  return BLOCKED_SECRET_WORDS.test(text) || BLOCKED_SECRET_VALUES.test(text);
}

export function buildCommunicationDraft(input: {
  draftType: DraftType;
  audience?: CommunicationAudience;
  channel?: CommunicationChannel;
  requestTemplate?: string | null;
  context: DraftContext;
}): CommunicationDraft {
  const audience = input.audience ?? "internal";
  const channel = input.channel ?? "email";
  const rendered = sanitizeDraftText(
    renderRequestTemplate(input.requestTemplate, input.context),
  );
  const need = String(input.context.client_need ?? input.context.requested_items ?? "the requested item");
  const reference = String(input.context.deal_reference ?? "this file");
  const who = String(input.context.contact_name ?? "").trim();
  const greeting = who ? `Hi ${who},` : "Hello,";
  const closer = input.context.processor_name
    ? `Thank you,\n${input.context.processor_name}`
    : "Thank you.";
  const opener =
    audience === "borrower"
      ? PORTAL_OPENERS[input.draftType]
      : DRAFT_OPENERS[input.draftType];
  const due = String(input.context.due_context ?? "").trim();
  const follow = String(input.context.follow_up_context ?? "").trim();
  const bodyCore = joinSentences(opener, rendered || `Please send ${need}.`, due, follow);
  const emailBody = sanitizeDraftText(`${greeting}\n\n${bodyCore}\n\n${closer}`);
  const portalBody = sanitizeDraftText(
    joinSentences(PORTAL_OPENERS[input.draftType], rendered || `Please send ${need}.`, due),
  );
  const sms = sanitizeDraftText(
    firstSentence(
      joinSentences(
        input.draftType === "follow_up" || input.draftType === "second_follow_up"
          ? "Following up:"
          : "",
        rendered || `Please send ${need} for ${reference}.`,
      ),
      240,
    ),
  );
  const subjectNeed = need.replace(/^the /i, "");
  const subjectPrefix =
    input.draftType === "replacement"
      ? "Replacement needed"
      : input.draftType === "follow_up" || input.draftType === "second_follow_up"
        ? "Follow-up"
        : input.draftType === "escalation"
          ? "Overdue request"
          : input.draftType === "thank_you"
            ? "Received — under review"
            : "Request";

  return {
    engine: "deterministic",
    draftType: input.draftType,
    audience,
    channel,
    subject: sanitizeDraftText(`${reference}: ${subjectPrefix} — ${subjectNeed}`),
    body: emailBody,
    sms,
    phoneScript: talkingPoints(bodyCore, who || null),
    portalBody,
  };
}

export function draftTextForChannel(
  draft: CommunicationDraft,
  channel: CommunicationChannel,
): { subject: string | null; body: string } {
  if (channel === "sms") {
    return { subject: null, body: draft.sms };
  }
  if (channel === "phone") {
    return { subject: null, body: draft.phoneScript };
  }
  if (channel === "portal") {
    return { subject: draft.subject, body: draft.portalBody };
  }
  return { subject: draft.subject, body: draft.body };
}

export function draftHasUnresolvedTokens(draft: CommunicationDraft): boolean {
  return (
    hasUnresolvedPlaybookPlaceholder(draft.subject) ||
    hasUnresolvedPlaybookPlaceholder(draft.body) ||
    hasUnresolvedPlaybookPlaceholder(draft.sms) ||
    hasUnresolvedPlaybookPlaceholder(draft.phoneScript) ||
    hasUnresolvedPlaybookPlaceholder(draft.portalBody)
  );
}
