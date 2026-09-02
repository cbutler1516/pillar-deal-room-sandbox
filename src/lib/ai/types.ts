export const SANDBOX_MOCK_AI_PROVIDER = "sandbox_mock_ai" as const;

export const AI_PROVIDERS = [SANDBOX_MOCK_AI_PROVIDER] as const;

export type AIProviderName = (typeof AI_PROVIDERS)[number];

export type AIFlagSeverity = "info" | "warning" | "blocker";

export type AIFlagKind =
  | "missing_item"
  | "blocker"
  | "stale"
  | "conflict"
  | "no_contact"
  | "replacement"
  | "review"
  | "simulated"
  | "rewrite_guard";

export type AICapability =
  | "summarize_deal"
  | "summarize_communications"
  | "identify_missing_items"
  | "identify_blockers"
  | "suggest_next_actions"
  | "rewrite_communication"
  | "flag_workflow_state"
  | "explain_recent_changes";

export const AI_ASSIST_DISCLAIMER =
  "Suggestion only. Nothing was sent.";

export const AI_REWRITE_CHANNELS = ["email", "sms", "phone", "portal"] as const;

export type AIRewriteChannel = (typeof AI_REWRITE_CHANNELS)[number];

export type AIDealNeed = {
  id: string;
  documentType: string;
  required: boolean;
  status: string;
};

export type AIDealDocument = {
  id: string;
  documentType: string | null;
  status: string;
};

export type AIDealTask = {
  id: string;
  title: string;
  status: string;
  sourceType: string | null;
  timing: string | null;
  clientNeedId: string | null;
  contactName: string | null;
  contactMissing: boolean;
  followUpDue: boolean;
  escalationDue: boolean;
  lastContactedAt: string | null;
  lastResponseAt: string | null;
  waitingSince: string | null;
  nextFollowUpAt: string | null;
};

export type AIDealCommunication = {
  id: string;
  status: string;
  channel: string;
  direction: string;
  sandboxSimulated: boolean;
  outboundSent: false;
  attemptedAt: string;
  draftType: string | null;
};

export type AIDealActivity = {
  eventType: string;
  createdAt: string;
};

export type AIDealSnapshot = {
  dealId: string;
  dealReference: string;
  borrowerName: string;
  loanType: string | null;
  status: string;
  assignedProcessorId: string | null;
  needs: AIDealNeed[];
  documents: AIDealDocument[];
  tasks: AIDealTask[];
  communications: AIDealCommunication[];
  activity: AIDealActivity[];
};

export type AISummaryRequest = {
  snapshot: AIDealSnapshot;
};

export type AINextActionSuggestion = {
  action: string;
  reason: string;
  target: "tasks" | "needs" | "documents" | "contacts" | "overview" | "conditions";
  href: string;
  executable: false;
};

export type AIWorkflowFlag = {
  kind: AIFlagKind;
  severity: AIFlagSeverity;
  title: string;
  detail: string;
};

export type AISummaryResult = {
  provider: AIProviderName;
  engine: "deterministic";
  dealSummary: string;
  communicationSummary: string;
  missingItems: string[];
  blockerSummary: string;
  nextActions: AINextActionSuggestion[];
  flags: AIWorkflowFlag[];
  recentChanges: string;
  executable: false;
  canMutateWorkflow: false;
};

export const AI_REWRITE_INTENTS = [
  "clarify",
  "shorten",
  "follow_up",
  "replacement",
] as const;

export type AIDraftRewriteIntent = (typeof AI_REWRITE_INTENTS)[number];

export function isAIDraftRewriteIntent(
  value: string,
): value is AIDraftRewriteIntent {
  return (AI_REWRITE_INTENTS as readonly string[]).includes(value);
}

export type AIDraftRewriteRequest = {
  snapshot: AIDealSnapshot;
  channel: AIRewriteChannel;
  currentSubject: string | null;
  currentBody: string;
  intent?: AIDraftRewriteIntent;
  taskId?: string | null;
};

export type AIDraftRewriteResult = {
  provider: AIProviderName;
  engine: "deterministic";
  subject: string;
  body: string;
  disclaimer: typeof AI_ASSIST_DISCLAIMER;
  flags: AIWorkflowFlag[];
  outboundSent: false;
  executable: false;
};

export function isAIRewriteChannel(value: string): value is AIRewriteChannel {
  return (AI_REWRITE_CHANNELS as readonly string[]).includes(value);
}

export type AIProvider = {
  name: AIProviderName;
  summarize(request: AISummaryRequest): Promise<AISummaryResult>;
  rewriteDraft(request: AIDraftRewriteRequest): Promise<AIDraftRewriteResult>;
};

export function isAIProviderName(value: string): value is AIProviderName {
  return (AI_PROVIDERS as readonly string[]).includes(value);
}
