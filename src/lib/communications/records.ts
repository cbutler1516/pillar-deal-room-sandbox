import { draftTextForChannel } from "@/lib/communications/drafts";
import type { CommunicationDraft } from "@/lib/communications/types";
import type {
  CommunicationAttemptInput,
  CommunicationChannel,
  DraftType,
} from "@/lib/communications/types";

const SIMULATED_LABEL = "SANDBOX — Simulated response";

export function buildContactedAttempt(input: {
  dealId: string;
  taskId: string | null;
  clientNeedId?: string | null;
  dealContactId?: string | null;
  createdBy: string | null;
  channel?: CommunicationChannel;
  draft?: CommunicationDraft | null;
  draftType?: DraftType | null;
  attemptedAt: string;
  audience?: "internal" | "borrower";
}): CommunicationAttemptInput {
  const channel = input.channel ?? input.draft?.channel ?? "email";
  const copy = input.draft
    ? draftTextForChannel(input.draft, channel)
    : { subject: null, body: "Marked contacted. Nothing was sent." };
  return {
    dealId: input.dealId,
    taskId: input.taskId,
    clientNeedId: input.clientNeedId ?? null,
    dealContactId: input.dealContactId ?? null,
    direction: "outbound",
    channel,
    status: "contacted",
    subject: copy.subject,
    bodySnapshot: copy.body,
    attemptedAt: input.attemptedAt,
    createdBy: input.createdBy,
    outboundSent: false,
    draftType: input.draftType ?? input.draft?.draftType ?? "initial",
    audience: input.audience ?? input.draft?.audience ?? "internal",
    sandboxSimulated: false,
  };
}

export function buildCopiedAttempt(input: {
  dealId: string;
  taskId: string | null;
  clientNeedId?: string | null;
  dealContactId?: string | null;
  createdBy: string | null;
  channel: CommunicationChannel;
  draft: CommunicationDraft;
  attemptedAt: string;
}): CommunicationAttemptInput {
  const copy = draftTextForChannel(input.draft, input.channel);
  return {
    dealId: input.dealId,
    taskId: input.taskId,
    clientNeedId: input.clientNeedId ?? null,
    dealContactId: input.dealContactId ?? null,
    direction: "outbound",
    channel: input.channel,
    status: "copied",
    subject: copy.subject,
    bodySnapshot: copy.body,
    attemptedAt: input.attemptedAt,
    createdBy: input.createdBy,
    outboundSent: false,
    draftType: input.draft.draftType,
    audience: input.draft.audience,
    sandboxSimulated: false,
  };
}

export function buildPortalMessageAttempt(input: {
  dealId: string;
  taskId: string | null;
  clientNeedId?: string | null;
  dealContactId?: string | null;
  createdBy: string | null;
  draft: CommunicationDraft;
  attemptedAt: string;
}): CommunicationAttemptInput {
  return {
    dealId: input.dealId,
    taskId: input.taskId,
    clientNeedId: input.clientNeedId ?? null,
    dealContactId: input.dealContactId ?? null,
    direction: "outbound",
    channel: "portal",
    status: "copied",
    subject: input.draft.subject,
    bodySnapshot: input.draft.portalBody,
    attemptedAt: input.attemptedAt,
    createdBy: input.createdBy,
    outboundSent: false,
    draftType: input.draft.draftType,
    audience: "borrower",
    sandboxSimulated: false,
  };
}

export function buildResponseReceivedAttempt(input: {
  dealId: string;
  taskId: string | null;
  clientNeedId?: string | null;
  dealContactId?: string | null;
  createdBy: string | null;
  attemptedAt: string;
  sandboxSimulated?: boolean;
  note?: string | null;
}): CommunicationAttemptInput {
  const simulated = input.sandboxSimulated === true;
  const note = input.note?.trim();
  return {
    dealId: input.dealId,
    taskId: input.taskId,
    clientNeedId: input.clientNeedId ?? null,
    dealContactId: input.dealContactId ?? null,
    direction: "inbound",
    channel: simulated ? "other" : "email",
    status: "responded",
    subject: simulated ? SIMULATED_LABEL : "Response received",
    bodySnapshot: simulated
      ? note
        ? `${SIMULATED_LABEL}. ${note}`
        : `${SIMULATED_LABEL}. Recorded for processor QA only. No real external message arrived.`
      : note || "Processor recorded a response. The task is not complete.",
    attemptedAt: input.attemptedAt,
    createdBy: input.createdBy,
    outboundSent: false,
    draftType: null,
    audience: "internal",
    sandboxSimulated: simulated,
  };
}

export function responseReceivedTaskPatch(nowIso: string): {
  status: "in_progress";
  waiting_since: null;
  last_response_at: string;
  completed_at: null;
} {
  return {
    status: "in_progress",
    waiting_since: null,
    last_response_at: nowIso,
    completed_at: null,
  };
}

export function isSimulatedAttempt(attempt: {
  sandboxSimulated: boolean;
  subject?: string | null;
  bodySnapshot?: string | null;
}): boolean {
  if (attempt.sandboxSimulated) {
    return true;
  }
  const haystack = `${attempt.subject ?? ""} ${attempt.bodySnapshot ?? ""}`;
  return haystack.includes(SIMULATED_LABEL);
}

export const SANDBOX_SIMULATED_LABEL = SIMULATED_LABEL;
