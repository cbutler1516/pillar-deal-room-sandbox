import { buildCommunicationDraft } from "@/lib/communications/drafts";
import { isSimulatedAttempt } from "@/lib/communications/records";
import type { CommunicationAttempt } from "@/lib/communications/types";

export type PortalMessage = {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
  simulated: boolean;
  kind: "request" | "replacement" | "follow_up";
};

const INTERNAL_LEAK =
  /\b(escalat(?:e|ion)|loan officer|internal|audit|processor queue|staff only)\b/i;

export function isBorrowerSafeAttempt(attempt: CommunicationAttempt): boolean {
  if (attempt.audience !== "borrower") {
    return false;
  }
  if (attempt.channel !== "portal" && attempt.channel !== "email") {
    return false;
  }
  if (attempt.sandboxSimulated) {
    return false;
  }
  if (attempt.draftType === "escalation") {
    return false;
  }
  const haystack = `${attempt.subject ?? ""} ${attempt.bodySnapshot}`;
  return !INTERNAL_LEAK.test(haystack);
}

export function portalMessagesFromAttempts(
  attempts: CommunicationAttempt[],
): PortalMessage[] {
  return attempts.filter(isBorrowerSafeAttempt).map((attempt) => ({
    id: attempt.id,
    subject: attempt.subject ?? "Request",
    body: attempt.bodySnapshot,
    createdAt: attempt.attemptedAt,
    simulated: isSimulatedAttempt(attempt),
    kind: attempt.draftType === "replacement" ? "replacement" : "request",
  }));
}

export function replacementPortalMessage(input: {
  needId: string;
  documentType: string;
  borrowerName?: string | null;
  dealReference?: string | null;
}): PortalMessage {
  const draft = buildCommunicationDraft({
    draftType: "replacement",
    audience: "borrower",
    channel: "portal",
    requestTemplate:
      "Please upload a replacement {{client_need}} for {{deal_reference}}.",
    context: {
      client_need: input.documentType,
      requested_items: input.documentType,
      borrower_name: input.borrowerName,
      deal_reference: input.dealReference,
    },
  });
  return {
    id: `replacement:${input.needId}`,
    subject: draft.subject,
    body: draft.portalBody,
    createdAt: new Date(0).toISOString(),
    simulated: false,
    kind: "replacement",
  };
}

export function borrowerPortalMessages(input: {
  attempts: CommunicationAttempt[];
  needs: Array<{
    id: string;
    documentType: string;
    required: boolean;
    status: string;
  }>;
  borrowerName?: string | null;
  dealReference?: string | null;
}): PortalMessage[] {
  const recorded = portalMessagesFromAttempts(input.attempts);
  const recordedNeedIds = new Set(
    input.attempts
      .filter((attempt) => attempt.clientNeedId && isBorrowerSafeAttempt(attempt))
      .map((attempt) => attempt.clientNeedId as string),
  );
  const replacements = input.needs
    .filter((need) => need.required && need.status === "rejected")
    .filter((need) => !recordedNeedIds.has(need.id))
    .map((need) =>
      replacementPortalMessage({
        needId: need.id,
        documentType: need.documentType,
        borrowerName: input.borrowerName,
        dealReference: input.dealReference,
      }),
    );
  return [...replacements, ...recorded].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}
