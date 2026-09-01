import { describe, expect, it } from "vitest";
import { communicationAging } from "@/lib/communications/aging";
import {
  buildCommunicationDraft,
  draftHasUnresolvedTokens,
  draftTextForChannel,
  hasBlockedSecrets,
} from "@/lib/communications/drafts";
import { matchesQueueFilter } from "@/lib/communications/filters";
import { historyItemsFromAttempts } from "@/lib/communications/history";
import {
  borrowerPortalMessages,
  isBorrowerSafeAttempt,
} from "@/lib/communications/portal";
import {
  buildContactedAttempt,
  communicationInsertErrorMessage,
  buildResponseReceivedAttempt,
  isSimulatedAttempt,
  responseReceivedTaskPatch,
  SANDBOX_SIMULATED_LABEL,
} from "@/lib/communications/records";
import {
  defaultFollowUpRule,
  recommendedDraftForTask,
  resolveFollowUpRule,
  sequenceStage,
} from "@/lib/communications/sequence";
import type { CommunicationAttempt } from "@/lib/communications/types";
import { summarizeWorkload } from "@/lib/communications/workload";
import { deriveDealNextAction } from "@/lib/ops/next-action";
import { priorityReasons } from "@/lib/ops/priority";
import { getPlaybook } from "@/lib/playbooks/registry";
import { templateContextFromDeal } from "@/lib/playbooks/templates";

const now = new Date("2026-08-31T18:00:00.000Z");

function attempt(
  partial: Partial<CommunicationAttempt> = {},
): CommunicationAttempt {
  return {
    id: "ca-1",
    dealId: "deal-1",
    taskId: "task-1",
    clientNeedId: "need-1",
    dealContactId: "c1",
    direction: "outbound",
    channel: "email",
    status: "contacted",
    subject: "PDR-APP-1: Request — ID",
    bodySnapshot: "Please send a government-issued photo ID.",
    attemptedAt: "2026-08-31T17:00:00.000Z",
    createdBy: "proc-1",
    outboundSent: false,
    draftType: "initial",
    audience: "internal",
    sandboxSimulated: false,
    ...partial,
  };
}

describe("processor communications drafts", () => {
  it("renders finished borrower email copy with no template tokens", () => {
    const playbook = getPlaybook("request_government_id");
    const draft = buildCommunicationDraft({
      draftType: "initial",
      requestTemplate: playbook?.requestTemplate,
      context: {
        ...templateContextFromDeal({
          borrowerName: "Alex Rivera",
          contactName: "Alex Rivera",
          propertyAddress: "100 Evaluation Ave",
          dealReference: "PDR-APP-1A606C84",
        }),
        client_need: "Government-issued ID",
        processor_name: "Chris Butler",
      },
    });
    expect(draft.engine).toBe("deterministic");
    expect(draft.body).toMatch(/Alex Rivera/);
    expect(draft.body).toMatch(/Chris Butler/);
    expect(draftHasUnresolvedTokens(draft)).toBe(false);
    expect(draft.body).not.toMatch(/\{\{|\$\{|\[client_need\]/);
  });

  it("strips unknown tokens and blocked secrets", () => {
    const draft = buildCommunicationDraft({
      draftType: "follow_up",
      requestTemplate:
        "Please send {{client_need}} and ignore {{unknown_var}} password 123-45-6789",
      context: { client_need: "Insurance Binder" },
    });
    expect(draft.body).toMatch(/Insurance Binder/);
    expect(draftHasUnresolvedTokens(draft)).toBe(false);
    expect(hasBlockedSecrets(draft.body)).toBe(false);
    expect(draft.body).not.toMatch(/123-45-6789|password/);
  });

  it("builds email, sms, phone, and borrower-safe portal variants", () => {
    const draft = buildCommunicationDraft({
      draftType: "follow_up",
      audience: "borrower",
      requestTemplate: "Please provide the current hazard insurance binder.",
      context: {
        contact_name: "Jordan Lee",
        deal_reference: "PDR-APP-1",
        client_need: "Insurance Binder",
      },
    });
    expect(draftTextForChannel(draft, "email").body).toMatch(/Jordan Lee/);
    expect(draftTextForChannel(draft, "sms").body.length).toBeLessThan(250);
    expect(draftTextForChannel(draft, "phone").body).toMatch(/Call Jordan Lee/);
    expect(draft.portalBody).not.toMatch(/escalat|loan officer|internal/i);
    expect(draft.portalBody).toMatch(/Insurance Binder|hazard insurance/i);
  });
});

describe("communication records", () => {
  it("records contacted attempts with outbound_sent false", () => {
    const draft = buildCommunicationDraft({
      draftType: "initial",
      requestTemplate: "Please send two months of bank statements.",
      context: { deal_reference: "PDR-APP-1", client_need: "Bank Statements" },
    });
    const row = buildContactedAttempt({
      dealId: "deal-1",
      taskId: "task-1",
      createdBy: "proc-1",
      draft,
      attemptedAt: now.toISOString(),
    });
    expect(row.status).toBe("contacted");
    expect(row.direction).toBe("outbound");
    expect(row.outboundSent).toBe(false);
    expect(row.sandboxSimulated).toBe(false);
  });

  it("does not treat a missing ledger as a successful write", () => {
    expect(
      communicationInsertErrorMessage(
        "Could not find the table 'public.communication_attempts' in the schema cache",
      ),
    ).toMatch(/ledger is unavailable/i);
    expect(communicationInsertErrorMessage("duplicate key")).toBe(
      "Unable to record this communication.",
    );
  });

  it("does not auto-complete when a response is recorded", () => {
    const patch = responseReceivedTaskPatch(now.toISOString());
    expect(patch.status).toBe("in_progress");
    expect(patch.waiting_since).toBeNull();
    expect(patch.last_response_at).toBe(now.toISOString());
    expect(patch.completed_at).toBeNull();
  });

  it("labels sandbox simulation and does not pretend a real message arrived", () => {
    const row = buildResponseReceivedAttempt({
      dealId: "deal-1",
      taskId: "task-1",
      createdBy: "proc-1",
      attemptedAt: now.toISOString(),
      sandboxSimulated: true,
    });
    expect(row.sandboxSimulated).toBe(true);
    expect(row.outboundSent).toBe(false);
    expect(row.subject).toBe(SANDBOX_SIMULATED_LABEL);
    expect(row.bodySnapshot).toMatch(/No real external message arrived/);
    expect(isSimulatedAttempt(row)).toBe(true);
    const history = historyItemsFromAttempts([{ ...row, id: "sim-1" }]);
    expect(history[0]?.title).toBe(SANDBOX_SIMULATED_LABEL);
    expect(history[0]?.simulated).toBe(true);
  });
});

describe("cadence and sequence", () => {
  it("defaults borrower, title, and insurance to a 24h follow-up", () => {
    expect(defaultFollowUpRule("borrower").followUpHours).toBe(24);
    expect(defaultFollowUpRule("insurance").followUpHours).toBe(24);
    expect(defaultFollowUpRule("title").escalationHours).toBe(48);
    expect(defaultFollowUpRule("contractor").followUpHours).toBe(48);
    expect(defaultFollowUpRule("cpa").escalationHours).toBe(96);
  });

  it("uses a task-specific cadence when one is set", () => {
    const rule = resolveFollowUpRule({
      sourceType: "insurance",
      followUpIntervalHours: 12,
      escalationAfterHours: 36,
    });
    expect(rule.followUpHours).toBe(12);
    expect(rule.escalationHours).toBe(36);
    expect(rule.source).toBe("task");
  });

  it("marks follow-up overdue and recommends a follow-up draft", () => {
    const task = {
      status: "waiting" as const,
      sourceType: "title",
      lastContactedAt: "2026-08-30T12:00:00.000Z",
      nextFollowUpAt: "2026-08-30T18:00:00.000Z",
      followUpIntervalHours: 24,
      escalationAfterHours: 48,
      escalationLevel: "none",
    };
    expect(sequenceStage(task, now)).toBe("follow_up");
    expect(communicationAging(task, now).followUpOverdue).toBe(true);
    expect(communicationAging(task, now).label).toBe("Follow-up overdue");
    expect(recommendedDraftForTask(task, {}, now).draftType).toBe("follow_up");
    expect(recommendedDraftForTask(task, {}, now).executable).toBe(false);
    expect(recommendedDraftForTask(task, {}, now).provider).toBeNull();
  });

  it("keeps waiting distinct from complete and does not escalate too early", () => {
    const waiting = {
      status: "waiting",
      sourceType: "borrower",
      lastContactedAt: "2026-08-31T16:00:00.000Z",
      waitingSince: "2026-08-31T16:00:00.000Z",
      nextFollowUpAt: "2026-09-01T16:00:00.000Z",
      followUpIntervalHours: 24,
      escalationAfterHours: 48,
      escalationLevel: "none",
    };
    expect(sequenceStage(waiting, now)).toBe("waiting");
    expect(sequenceStage({ ...waiting, status: "completed" }, now)).toBe(
      "complete",
    );
  });

  it("filters the processor queue for no-contact and overdue follow-up", () => {
    expect(
      matchesQueueFilter(
        {
          id: "t1",
          status: "open",
          sourceType: "borrower",
          lastContactedAt: null,
        },
        "no_contact",
        now,
      ),
    ).toBe(true);
    expect(
      matchesQueueFilter(
        {
          id: "t2",
          status: "waiting",
          sourceType: "title",
          nextFollowUpAt: "2026-08-30T12:00:00.000Z",
          followUpDue: true,
        },
        "overdue",
        now,
      ),
    ).toBe(true);
  });
});

describe("next action, priority, portal, and workload", () => {
  it("orients next action to follow-up after contact and to review after a response", () => {
    const followUp = deriveDealNextAction({
      dealId: "deal-1",
      needs: [
        {
          id: "need-1",
          documentType: "Title Commitment",
          required: true,
          status: "requested",
        },
      ],
      documents: [],
      nextActions: [
        {
          id: "task-1",
          dealId: "deal-1",
          title: "Request title commitment",
          status: "waiting",
          priority: "high",
          timing: "required_now",
          taskKind: "request_document",
          sourceType: "title",
          instructions: null,
          completionRule: null,
          dueAt: null,
          nextFollowUpAt: "2026-08-30T12:00:00.000Z",
          lastContactedAt: "2026-08-30T10:00:00.000Z",
          lastResponseAt: null,
          waitingSince: "2026-08-30T10:00:00.000Z",
          followUpIntervalHours: 24,
          escalationAfterHours: 48,
          escalationLevel: "none",
          assignedTo: "proc-1",
          createdAt: "2026-08-29T12:00:00.000Z",
          playbookKey: "request_title_commitment",
          clientNeedId: "need-1",
          dealContactId: "c1",
          rank: 1,
          band: "follow_up_due",
          followUpDue: true,
          escalationDue: false,
          overdue: true,
          contactMissing: false,
          waitingAgeHours: 32,
          instructionsSummary: "",
          borrowerName: "Alex Rivera",
          entityName: null,
          dealReference: "PDR-APP-1",
          loanType: "dscr",
          propertyAddress: null,
          contactName: "Taylor Reed",
          contactCompany: null,
          contactEmail: "title@example.test",
          contactPhone: "555-0199",
          suggestedRequest: "Request the title commitment.",
          requestText: "Please send the title commitment.",
        },
      ],
    });
    expect(followUp?.action).toMatch(/Follow up with Taylor Reed/i);
  });

  it("uses Follow-up overdue as the staff-readable priority reason", () => {
    const reasons = priorityReasons({
      escalated: false,
      overdueReplacement: false,
      requiredBlockerNearFunding: false,
      replacementNeeded: false,
      missingContactRequiredNow: false,
      overdueFollowUp: true,
      documentAwaitingReview: false,
      newUnclaimed: false,
      requiredNowIncomplete: false,
      activeCollection: false,
      requiredLaterOnly: false,
      optionalOnly: false,
      noInitialContactRequiredNow: false,
      responseAwaitingReview: false,
      waitingBeyondSla: false,
    });
    expect(reasons).toContain("Follow-up overdue");
    expect(reasons.join(" ")).not.toMatch(/Follow-up due$/);
  });

  it("keeps the borrower portal free of internal and simulated rows", () => {
    const messages = borrowerPortalMessages({
      attempts: [
        attempt({
          audience: "borrower",
          channel: "portal",
          draftType: "replacement",
          bodySnapshot: "Please upload a replacement Government-issued ID.",
        }),
        attempt({
          id: "internal-1",
          audience: "internal",
          draftType: "escalation",
          bodySnapshot: "Escalate to the loan officer.",
        }),
        attempt({
          id: "sim-1",
          sandboxSimulated: true,
          subject: SANDBOX_SIMULATED_LABEL,
          bodySnapshot: `${SANDBOX_SIMULATED_LABEL}. No real external message arrived.`,
        }),
      ],
      needs: [
        {
          id: "need-2",
          documentType: "Bank Statements",
          required: true,
          status: "rejected",
        },
      ],
      borrowerName: "Alex Rivera",
      dealReference: "PDR-APP-1",
    });
    expect(messages.every((item) => !item.simulated)).toBe(true);
    expect(messages.some((item) => item.kind === "replacement")).toBe(true);
    expect(messages.join(" ")).not.toMatch(/loan officer|Escalate/i);
    expect(
      isBorrowerSafeAttempt(
        attempt({
          audience: "internal",
          draftType: "escalation",
          bodySnapshot: "Escalate to the loan officer.",
        }),
      ),
    ).toBe(false);
  });

  it("names processors on the workload summary without touching a network", () => {
    const rows = summarizeWorkload(
      [
        {
          status: "open",
          sourceType: "borrower",
          assignedTo: "proc-1",
          lastContactedAt: null,
        },
        {
          status: "waiting",
          sourceType: "insurance",
          assignedTo: "proc-1",
          lastContactedAt: "2026-08-30T12:00:00.000Z",
          nextFollowUpAt: "2026-08-30T18:00:00.000Z",
          followUpIntervalHours: 24,
        },
      ],
      { "proc-1": "Chris Butler" },
      now,
    );
    expect(rows[0]?.processorName).toBe("Chris Butler");
    expect(rows[0]?.noContact).toBe(1);
    expect(rows[0]?.followUpOverdue).toBe(1);
    expect(rows[0]?.waiting).toBe(1);
  });
});
