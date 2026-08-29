import { describe, expect, it } from "vitest";
import { assertSandboxGuard } from "@/lib/sandbox";
import {
  applyTaskCompletion,
  dealAlreadyHasPlaybookTask,
  evaluateCompletionReadiness,
  instantiatePlaybook,
  isEscalationDue,
  isFollowUpDue,
  nextFollowUpAtFrom,
  rankNextActions,
  resolveClientNeedForPlaybook,
  type RankableTask,
} from "@/lib/playbooks/logic";
import {
  baselinePlaybookKeysForLoanType,
  getPlaybook,
  listPlaybooks,
} from "@/lib/playbooks/registry";

const now = new Date("2026-08-28T18:00:00.000Z");

function task(partial: Partial<RankableTask> & Pick<RankableTask, "id" | "title">): RankableTask {
  return {
    dealId: "deal-1",
    status: "open",
    priority: "normal",
    timing: "required_now",
    taskKind: "request_document",
    sourceType: "borrower",
    instructions: "Do the work.",
    completionRule: "Processor marks accepted.",
    dueAt: null,
    nextFollowUpAt: null,
    lastContactedAt: null,
    waitingSince: null,
    followUpIntervalHours: 24,
    escalationAfterHours: 48,
    escalationLevel: "none",
    assignedTo: null,
    createdAt: "2026-08-26T10:00:00.000Z",
    playbookKey: null,
    ...partial,
  };
}

describe("playbook registry", () => {
  it("creates a borrower-source task from a playbook", () => {
    const playbook = getPlaybook("request_bank_statements");
    expect(playbook).toBeTruthy();
    const instance = instantiatePlaybook(playbook!);
    expect(instance.sourceType).toBe("borrower");
    expect(instance.taskKind).toBe("request_document");
    expect(instance.timing).toBe("required_now");
    expect(instance.instructions).toMatch(/verify/i);
    expect(instance.instructions).toMatch(/every page/i);
    expect(instance.completionRule).toMatch(/approved or explicitly accepted/i);
    expect(playbook!.completionRule.autoUnderwrite).toBe(false);
  });

  it("creates a third-party-source task from a playbook", () => {
    const playbook = getPlaybook("request_closing_protection_letter");
    expect(playbook?.sourceType).toBe("title");
    expect(playbook?.taskKind).toBe("contact_third_party");
    const instance = instantiatePlaybook(playbook!);
    expect(instance.sourceType).toBe("title");
    expect(instance.instructions).toMatch(/CPL/i);
    expect(instance.completionRule).not.toMatch(/underwrite/i);
  });

  it("keeps required_now, required_later, and optional distinct", () => {
    expect(getPlaybook("request_bank_statements")?.timing).toBe("required_now");
    expect(getPlaybook("request_closing_protection_letter")?.timing).toBe(
      "required_later",
    );
    expect(getPlaybook("request_contractor_insurance")?.timing).toBe("optional");
    expect(
      instantiatePlaybook(getPlaybook("request_bank_statements")!, {
        timing: "required_later",
      }).timing,
    ).toBe("required_later");
  });

  it("maps sandbox loan types to baseline playbooks", () => {
    expect(baselinePlaybookKeysForLoanType("Fix & Flip")).toEqual([
      "request_purchase_agreement",
      "request_entity_documents",
      "request_bank_statements",
      "request_rehab_budget",
      "request_scope_of_work",
    ]);
    expect(baselinePlaybookKeysForLoanType("DSCR Purchase")).toContain(
      "request_purchase_agreement",
    );
    expect(baselinePlaybookKeysForLoanType("DSCR Refinance")).toContain(
      "request_mortgage_statement",
    );
    expect(baselinePlaybookKeysForLoanType("Commercial Bridge")).toEqual([
      "request_rent_roll",
      "request_t12",
      "request_pfs",
      "request_sreo",
      "request_entity_documents",
      "request_purchase_agreement",
    ]);
  });

  it("exposes operational instructions on every playbook", () => {
    for (const playbook of listPlaybooks()) {
      expect(playbook.instructions.length).toBeGreaterThan(40);
      expect(playbook.completionRule.autoUnderwrite).toBe(false);
    }
  });
});

describe("waiting, follow-up, and escalation", () => {
  it("treats waiting as an active state that can be due for follow-up", () => {
    expect(
      isFollowUpDue(
        task({
          id: "1",
          title: "Wait on title",
          status: "waiting",
          nextFollowUpAt: "2026-08-28T12:00:00.000Z",
        }),
        now,
      ),
    ).toBe(true);
    expect(
      isFollowUpDue(
        task({
          id: "2",
          title: "Done",
          status: "completed",
          nextFollowUpAt: "2026-08-28T12:00:00.000Z",
        }),
        now,
      ),
    ).toBe(false);
  });

  it("calculates follow-up due from last contacted plus interval", () => {
    const due = nextFollowUpAtFrom("2026-08-27T18:00:00.000Z", 24);
    expect(due).toBe("2026-08-28T18:00:00.000Z");
    expect(
      isFollowUpDue(
        task({
          id: "3",
          title: "Interval",
          lastContactedAt: "2026-08-27T17:00:00.000Z",
          followUpIntervalHours: 24,
          nextFollowUpAt: null,
        }),
        now,
      ),
    ).toBe(true);
  });

  it("calculates escalation due from waiting age", () => {
    expect(
      isEscalationDue(
        task({
          id: "4",
          title: "Escalate",
          status: "waiting",
          waitingSince: "2026-08-26T12:00:00.000Z",
          escalationAfterHours: 48,
          escalationLevel: "none",
        }),
        now,
      ),
    ).toBe(true);
    expect(
      isEscalationDue(
        task({
          id: "5",
          title: "Not yet",
          status: "waiting",
          waitingSince: "2026-08-28T12:00:00.000Z",
          escalationAfterHours: 48,
          escalationLevel: "none",
        }),
        now,
      ),
    ).toBe(false);
  });

  it("ranks overdue and escalation above required_now and follow-up", () => {
    const ranked = rankNextActions(
      [
        task({
          id: "opt",
          title: "Optional contractor",
          timing: "optional",
          taskKind: "contact_third_party",
        }),
        task({
          id: "later",
          title: "Required later CPL",
          timing: "required_later",
          sourceType: "title",
        }),
        task({
          id: "review",
          title: "Review statements",
          timing: "required_later",
          taskKind: "review_document",
        }),
        task({
          id: "follow",
          title: "Follow up lease",
          timing: "required_later",
          nextFollowUpAt: "2026-08-28T08:00:00.000Z",
        }),
        task({
          id: "now",
          title: "Bank statements",
          timing: "required_now",
        }),
        task({
          id: "esc",
          title: "Escalation",
          timing: "optional",
          waitingSince: "2026-08-26T10:00:00.000Z",
          status: "waiting",
        }),
      ],
      now,
    );
    expect(ranked.map((row) => row.id)).toEqual([
      "esc",
      "now",
      "follow",
      "review",
      "later",
      "opt",
    ]);
  });

  it("ranks required_now blocked missing-contact above required_now", () => {
    const ranked = rankNextActions(
      [
        task({
          id: "ready",
          title: "Bank statements",
          timing: "required_now",
          playbookKey: "request_bank_statements",
          dealContactId: "c1",
        }),
        task({
          id: "blocked",
          title: "Insurance binder",
          timing: "required_now",
          playbookKey: "request_insurance_binder",
          dealContactId: null,
          blockedReason: "contact_missing",
        }),
      ],
      now,
    );
    expect(ranked.map((row) => row.id)).toEqual(["blocked", "ready"]);
    expect(ranked[0]?.contactMissing).toBe(true);
  });
});

describe("client need integration", () => {
  it("links a borrower playbook to an existing Client Need without duplicating", () => {
    const playbook = getPlaybook("request_bank_statements")!;
    const existing = [
      {
        id: "need-1",
        documentType: "Bank Statements / Liquidity",
        category: "Liquidity",
      },
    ];
    const first = resolveClientNeedForPlaybook(playbook, existing);
    const second = resolveClientNeedForPlaybook(playbook, existing);
    expect(first.shouldCreateNeed).toBe(false);
    expect(first.clientNeedId).toBe("need-1");
    expect(second.clientNeedId).toBe("need-1");
    expect(second.shouldCreateNeed).toBe(false);
  });

  it("creates a Client Need only when the playbook requires one and none matches", () => {
    const playbook = getPlaybook("request_bank_statements")!;
    const resolved = resolveClientNeedForPlaybook(playbook, []);
    expect(resolved.shouldCreateNeed).toBe(true);
    expect(resolved.clientNeedId).toBeNull();
  });

  it("does not invent a Client Need for third-party tasks that only link when present", () => {
    const review = getPlaybook("review_bank_statements")!;
    expect(review.createsClientNeed).toBe(false);
    expect(resolveClientNeedForPlaybook(review, []).shouldCreateNeed).toBe(false);
  });

  it("skips a second task for the same playbook key", () => {
    expect(
      dealAlreadyHasPlaybookTask(
        [{ playbookKey: "request_bank_statements", status: "open" }],
        "request_bank_statements",
      ),
    ).toBe(true);
    expect(
      dealAlreadyHasPlaybookTask(
        [{ playbookKey: "request_bank_statements", status: "dismissed" }],
        "request_bank_statements",
      ),
    ).toBe(false);
  });
});

describe("completion rules", () => {
  it("never auto-underwrites when a task is completed", () => {
    const result = applyTaskCompletion();
    expect(result.autoUnderwrite).toBe(false);
    expect(result.updatesClientNeedStatus).toBe(false);
    expect(result.creditDecision).toBeNull();

    const readiness = evaluateCompletionReadiness({
      requiresLinkedNeed: true,
      requiresNeedApprovedOrAccepted: true,
      requiresDocumentLinked: true,
      requiresProcessorAccepted: true,
      linkedNeedStatus: "needs_review",
      hasLinkedDocument: true,
      processorAccepted: true,
    });
    expect(readiness.autoUnderwrite).toBe(false);
    expect(readiness.updatesClientNeedStatus).toBe(false);
    expect(readiness.ready).toBe(false);
  });
});

describe("sandbox guard", () => {
  it("keeps playbook mutations inside the sandbox", () => {
    expect(() =>
      assertSandboxGuard({
        SANDBOX_MODE: "false",
        PRODUCTION_INTEGRATIONS_ENABLED: "false",
      }),
    ).toThrow(/SANDBOX_MODE/);
    expect(() =>
      assertSandboxGuard({
        SANDBOX_MODE: "true",
        PRODUCTION_INTEGRATIONS_ENABLED: "true",
      }),
    ).toThrow(/PRODUCTION_INTEGRATIONS_ENABLED/);
  });
});
