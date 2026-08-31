export const COMMUNICATION_CHANNELS = [
  "email",
  "sms",
  "phone",
  "portal",
  "internal",
  "other",
] as const;

export const COMMUNICATION_DIRECTIONS = [
  "outbound",
  "inbound",
  "internal",
] as const;

export const COMMUNICATION_STATUSES = [
  "drafted",
  "copied",
  "contacted",
  "waiting",
  "responded",
  "failed",
  "canceled",
] as const;

export const DRAFT_TYPES = [
  "initial",
  "follow_up",
  "second_follow_up",
  "escalation",
  "replacement",
  "thank_you",
] as const;

export const COMMUNICATION_AUDIENCES = ["internal", "borrower"] as const;

export const SEQUENCE_STAGES = [
  "no_contact",
  "waiting",
  "follow_up",
  "second_follow_up",
  "escalation",
  "response_received",
  "complete",
] as const;

export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];
export type CommunicationDirection = (typeof COMMUNICATION_DIRECTIONS)[number];
export type CommunicationStatus = (typeof COMMUNICATION_STATUSES)[number];
export type DraftType = (typeof DRAFT_TYPES)[number];
export type CommunicationAudience = (typeof COMMUNICATION_AUDIENCES)[number];
export type SequenceStage = (typeof SEQUENCE_STAGES)[number];
export type DraftEngine = "deterministic";

export type CommunicationDraft = {
  engine: DraftEngine;
  draftType: DraftType;
  audience: CommunicationAudience;
  channel: CommunicationChannel;
  subject: string;
  body: string;
  sms: string;
  phoneScript: string;
  portalBody: string;
};

export type CommunicationAttemptInput = {
  dealId: string;
  taskId: string | null;
  clientNeedId: string | null;
  dealContactId: string | null;
  direction: CommunicationDirection;
  channel: CommunicationChannel;
  status: CommunicationStatus;
  subject: string | null;
  bodySnapshot: string;
  attemptedAt: string;
  createdBy: string | null;
  outboundSent: false;
  draftType: DraftType | null;
  audience: CommunicationAudience;
  sandboxSimulated: boolean;
};

export type CommunicationAttempt = CommunicationAttemptInput & {
  id: string;
};

export type FollowUpRule = {
  followUpHours: number;
  escalationHours: number;
  source: "task" | "default";
};

export type AutomationRecommendation = {
  stage: SequenceStage;
  draftType: DraftType | null;
  reason: string;
  provider: null;
  executable: false;
};

export function isCommunicationChannel(
  value: string,
): value is CommunicationChannel {
  return (COMMUNICATION_CHANNELS as readonly string[]).includes(value);
}

export function isDraftType(value: string): value is DraftType {
  return (DRAFT_TYPES as readonly string[]).includes(value);
}

export function isCommunicationAudience(
  value: string,
): value is CommunicationAudience {
  return (COMMUNICATION_AUDIENCES as readonly string[]).includes(value);
}
