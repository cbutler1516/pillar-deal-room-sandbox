import { describe, expect, it } from "vitest";
import { getAIProviderName } from "./config";
import { getAIProvider } from "./factory";
import { getSandboxMockAIProvider } from "./mock-provider";
import { buildAIDealSnapshot } from "./snapshot";
import {
  canRequestAIAssist,
  canUseAICapability,
  canViewAIAssist,
} from "./authorization";
import { AI_ASSIST_DISCLAIMER, type AIDealSnapshot } from "./types";
import type { CommunicationAttempt } from "@/lib/communications/types";

const sandboxEnv = {
  SANDBOX_MODE: "true",
  PRODUCTION_INTEGRATIONS_ENABLED: "false",
};

function deal() {
  return {
    id: "deal-1",
    dealReference: "PDR-APP-1",
    borrowerName: "Alex Rivera",
    loanType: "dscr",
    status: "collecting_documents" as const,
    assignedProcessorId: "proc-1",
  };
}

function need(
  overrides: Partial<{
    id: string;
    documentType: string;
    required: boolean;
    status: string;
  }> = {},
) {
  return {
    id: "need-1",
    documentType: "Pay stubs",
    required: true,
    status: "requested",
    ...overrides,
  };
}

function document(
  overrides: Partial<{
    id: string;
    documentType: string | null;
    status: string;
  }> = {},
) {
  return {
    id: "doc-1",
    documentType: "Pay stubs",
    status: "received",
    ...overrides,
  };
}

function task(
  overrides: Partial<{
    id: string;
    title: string;
    status: string;
    sourceType: string | null;
    timing: string | null;
    clientNeedId: string | null;
    contactName: string | null;
    dealContactId: string | null;
    lastContactedAt: string | null;
    lastResponseAt: string | null;
    waitingSince: string | null;
    nextFollowUpAt: string | null;
  }> = {},
) {
  return {
    id: "task-1",
    title: "Collect pay stubs",
    status: "open",
    sourceType: "borrower",
    timing: "required_now",
    clientNeedId: "need-1",
    contactName: "Alex Rivera",
    dealContactId: null,
    lastContactedAt: null,
    lastResponseAt: null,
    waitingSince: null,
    nextFollowUpAt: null,
    ...overrides,
  };
}

function communication(
  overrides: Partial<CommunicationAttempt> = {},
): CommunicationAttempt {
  return {
    id: "comm-1",
    dealId: "deal-1",
    taskId: "task-1",
    clientNeedId: "need-1",
    dealContactId: null,
    direction: "outbound",
    channel: "email",
    status: "copied",
    subject: "Pay stubs needed",
    bodySnapshot: "Please upload pay stubs. Do not email secrets.",
    attemptedAt: "2026-08-21T12:00:00.000Z",
    createdBy: "proc-1",
    outboundSent: false,
    draftType: "initial",
    audience: "borrower",
    sandboxSimulated: false,
    ...overrides,
  };
}

function activity(
  overrides: Partial<{ eventType: string; createdAt: string }> = {},
) {
  return {
    id: "act-1",
    eventType: "deal_status_changed",
    actorType: "user",
    actorId: "proc-1",
    createdAt: "2026-08-21T00:00:00.000Z",
    safeMetadata: { to: "collecting_documents" },
    ...overrides,
  };
}

function snapshot(overrides: Partial<AIDealSnapshot> = {}): AIDealSnapshot {
  return {
    ...buildAIDealSnapshot({
      deal: deal(),
      needs: [need()],
      documents: [document()],
      tasks: [task()],
      communications: [communication()],
      activity: [activity()],
    }),
    ...overrides,
  };
}

describe("AI provider factory", () => {
  it("defaults to sandbox_mock_ai when AI_PROVIDER is unset", () => {
    expect(getAIProviderName(sandboxEnv)).toBe("sandbox_mock_ai");
    expect(getAIProvider(sandboxEnv).name).toBe("sandbox_mock_ai");
  });

  it("uses sandbox_mock_ai when that provider is selected", () => {
    expect(
      getAIProvider({ ...sandboxEnv, AI_PROVIDER: "sandbox_mock_ai" }).name,
    ).toBe("sandbox_mock_ai");
  });

  it("refuses a real AI provider", () => {
    expect(() =>
      getAIProviderName({ ...sandboxEnv, AI_PROVIDER: "openai" }),
    ).toThrow(/disabled/i);
    expect(() =>
      getAIProvider({ ...sandboxEnv, AI_PROVIDER: "anthropic" }),
    ).toThrow(/disabled/i);
  });

  it("refuses AI when the sandbox guard is invalid", () => {
    expect(() =>
      getAIProviderName({
        SANDBOX_MODE: "false",
        PRODUCTION_INTEGRATIONS_ENABLED: "false",
      }),
    ).toThrow(/SANDBOX_MODE/);
    expect(() =>
      getAIProviderName({
        SANDBOX_MODE: "true",
        PRODUCTION_INTEGRATIONS_ENABLED: "true",
      }),
    ).toThrow(/PRODUCTION_INTEGRATIONS_ENABLED/);
  });

  it("does not require network access", async () => {
    const result = await getAIProvider(sandboxEnv).summarize({
      snapshot: snapshot(),
    });
    expect(result.provider).toBe("sandbox_mock_ai");
    expect(result.engine).toBe("deterministic");
    expect(result.dealSummary.length).toBeGreaterThan(10);
  });
});

describe("sandbox mock AI", () => {
  it("returns deterministic results for the same snapshot", async () => {
    const provider = getSandboxMockAIProvider();
    const input = snapshot();
    const first = await provider.summarize({ snapshot: input });
    const second = await provider.summarize({ snapshot: input });
    expect(first).toEqual(second);
  });

  it("does not persist or mutate the snapshot", async () => {
    const provider = getSandboxMockAIProvider();
    const input = snapshot();
    const frozen = structuredClone(input);
    await provider.summarize({ snapshot: input });
    expect(input).toEqual(frozen);
  });

  it("summarizes open lender conditions without making them executable", async () => {
    const provider = getSandboxMockAIProvider();
    const result = await provider.summarize({
      snapshot: buildAIDealSnapshot({
        deal: deal(),
        needs: [need({ status: "approved" })],
        documents: [document({ status: "approved" })],
        tasks: [
          task({
            title: "Updated insurance binder",
            sourceType: "lender",
            status: "open",
          }),
        ],
        communications: [],
        activity: [],
      }),
    });
    expect(result.dealSummary).toMatch(/lender condition/i);
    expect(result.nextActions.some((item) => item.target === "conditions")).toBe(
      true,
    );
    expect(result.nextActions.every((item) => item.executable === false)).toBe(
      true,
    );
  });

  it("never marks suggestions as executable", async () => {
    const provider = getSandboxMockAIProvider();
    const result = await provider.summarize({ snapshot: snapshot() });
    expect(result.nextActions.every((item) => item.executable === false)).toBe(
      true,
    );
    expect(result.canMutateWorkflow).toBe(false);
    expect(result.executable).toBe(false);
  });

  it("flags missing required items", async () => {
    const provider = getSandboxMockAIProvider();
    const result = await provider.summarize({ snapshot: snapshot() });
    expect(result.flags.some((flag) => flag.kind === "missing_item")).toBe(true);
    expect(result.missingItems.some((item) => item.includes("Pay stubs"))).toBe(
      true,
    );
  });

  it("flags a replacement request after rejection", async () => {
    const provider = getSandboxMockAIProvider();
    const result = await provider.summarize({
      snapshot: buildAIDealSnapshot({
        deal: deal(),
        needs: [need({ status: "rejected" })],
        documents: [document({ status: "rejected" })],
        tasks: [task({ status: "open" })],
        communications: [],
        activity: [],
      }),
    });
    expect(result.flags.some((flag) => flag.kind === "replacement")).toBe(true);
    expect(result.blockerSummary).toMatch(/Replacement needed/i);
  });

  it("flags missing contact on a third-party wait", async () => {
    const provider = getSandboxMockAIProvider();
    const result = await provider.summarize({
      snapshot: buildAIDealSnapshot({
        deal: deal(),
        needs: [need()],
        documents: [],
        tasks: [
          task({
            sourceType: "title",
            contactName: null,
            dealContactId: null,
            lastContactedAt: null,
          }),
        ],
        communications: [],
        activity: [],
      }),
    });
    expect(result.flags.some((flag) => flag.kind === "no_contact")).toBe(true);
  });

  it("flags conflicting waiting-after-response state", async () => {
    const provider = getSandboxMockAIProvider();
    const result = await provider.summarize({
      snapshot: buildAIDealSnapshot({
        deal: deal(),
        needs: [need({ status: "received" })],
        documents: [document({ status: "needs_review" })],
        tasks: [
          task({
            status: "waiting",
            lastResponseAt: "2026-08-22T00:00:00.000Z",
            lastContactedAt: "2026-08-21T00:00:00.000Z",
            waitingSince: "2026-08-21T00:00:00.000Z",
          }),
        ],
        communications: [
          communication({ direction: "inbound", status: "responded" }),
        ],
        activity: [],
      }),
    });
    expect(result.flags.some((flag) => flag.kind === "conflict")).toBe(true);
  });

  it("summarizes recent changes from activity and communications", async () => {
    const provider = getSandboxMockAIProvider();
    const result = await provider.summarize({ snapshot: snapshot() });
    expect(result.recentChanges).toMatch(/deal status changed/i);
    expect(result.recentChanges).toMatch(/copied email/i);
    expect(result.communicationSummary).toMatch(/outbound_sent is false/i);
  });

  it("does not rewrite copy that promises terms or sends messages", async () => {
    const provider = getSandboxMockAIProvider();
    const result = await provider.rewriteDraft({
      snapshot: snapshot(),
      channel: "email",
      currentSubject: "You're approved at 6.5%",
      currentBody:
        "You're approved. I'll send this now. Your creditworthiness looks strong and the lender is selected.",
      intent: "clarify",
    });
    expect(result.body.toLowerCase()).not.toMatch(
      /approved|creditworth|lender selected|i'll send|6\.5%/,
    );
    expect(result.body).toContain(AI_ASSIST_DISCLAIMER);
    expect(result.disclaimer).toBe(AI_ASSIST_DISCLAIMER);
    expect(result.outboundSent).toBe(false);
    expect(result.executable).toBe(false);
    expect(result.flags.some((flag) => flag.kind === "rewrite_guard")).toBe(
      true,
    );
  });
});

describe("AI authorization", () => {
  it("lets processors and admins request assist", () => {
    expect(canRequestAIAssist("admin")).toBe(true);
    expect(canRequestAIAssist("processor")).toBe(true);
    expect(canRequestAIAssist("loan_officer")).toBe(false);
    expect(canUseAICapability("processor", "rewrite_communication")).toBe(true);
    expect(canUseAICapability("loan_officer", "rewrite_communication")).toBe(
      false,
    );
  });

  it("lets loan officers view summaries", () => {
    expect(canViewAIAssist("loan_officer")).toBe(true);
    expect(canUseAICapability("loan_officer", "summarize_deal")).toBe(true);
  });
});

describe("AI deal snapshot", () => {
  it("does not include email, phone, or secret fields", () => {
    const built = buildAIDealSnapshot({
      deal: deal(),
      needs: [need()],
      documents: [document()],
      tasks: [task()],
      communications: [communication()],
      activity: [activity()],
    });
    const serialized = JSON.stringify(built);
    expect(serialized).not.toMatch(/@|ssn|password|secret|borrowerEmail|contactEmail/i);
    expect(serialized).not.toMatch(/bodySnapshot|bodyPreview/);
    expect(built.communications[0]?.outboundSent).toBe(false);
    expect("borrowerEmail" in built).toBe(false);
  });
});
