import { describe, expect, it } from "vitest";
import {
  compareDealPriority,
  priorityReasons,
  rankDealPriority,
  type PriorityDeal,
  type PriorityNeed,
  type PriorityTask,
} from "@/lib/ops/priority";

const now = new Date("2026-08-29T16:00:00.000Z");

function deal(partial: Partial<PriorityDeal> = {}): PriorityDeal {
  return {
    id: "eval-1",
    status: "collecting_documents",
    assignedProcessorId: "proc-1",
    createdAt: "2026-08-29T12:00:00.000Z",
    dealReference: "PDR-APP-1A606C84",
    ...partial,
  };
}

function need(partial: Partial<PriorityNeed> = {}): PriorityNeed {
  return {
    dealId: "eval-1",
    required: true,
    status: "requested",
    documentType: "Government-issued ID",
    timing: "required_now",
    ...partial,
  };
}

function task(partial: Partial<PriorityTask> = {}): PriorityTask {
  return {
    dealId: "eval-1",
    status: "open",
    priority: "normal",
    timing: "required_now",
    sourceType: "borrower",
    playbookKey: "request_government_id",
    blockedReason: null,
    nextFollowUpAt: null,
    lastContactedAt: null,
    followUpIntervalHours: 24,
    escalationAfterHours: 48,
    escalationLevel: "none",
    createdAt: "2026-08-29T12:00:00.000Z",
    ...partial,
  };
}

describe("deal priority ranking", () => {
  it("scores replacement required as high", () => {
    const ranked = rankDealPriority(
      deal(),
      [need({ status: "rejected" })],
      [],
      [task()],
      now,
    );
    expect(ranked.band).toBe("high");
    expect(ranked.reasons.some((reason) => /Replacement needed/.test(reason))).toBe(
      true,
    );
    expect(ranked.score).toBeGreaterThan(50);
  });

  it("scores missing contact on required-now as high", () => {
    const ranked = rankDealPriority(
      deal(),
      [need({ status: "requested", documentType: "Insurance Binder" })],
      [],
      [
        task({
          playbookKey: "request_insurance_binder",
          sourceType: "insurance",
          blockedReason: "contact_missing",
          dealContactId: null,
        }),
      ],
      now,
    );
    expect(ranked.band).toBe("high");
    expect(ranked.signals.missingContactRequiredNow).toBe(true);
  });

  it("scores overdue follow-up as high", () => {
    const ranked = rankDealPriority(
      deal(),
      [need()],
      [],
      [task({ nextFollowUpAt: "2026-08-29T10:00:00.000Z" })],
      now,
    );
    expect(ranked.band).toBe("high");
    expect(ranked.signals.overdueFollowUp).toBe(true);
  });

  it("exposes a staff-readable explanation", () => {
    const ranked = rankDealPriority(
      deal(),
      [need({ status: "rejected" })],
      [],
      [task({ nextFollowUpAt: "2026-08-29T10:00:00.000Z" })],
      now,
    );
    const reasons = priorityReasons(ranked.signals, [
      need({ status: "rejected" }),
    ]);
    expect(ranked.label).toMatch(/High|Critical/);
    expect(reasons.join(" ")).toMatch(/replacement/i);
    expect(reasons.join(" ")).toMatch(/Follow-up due/);
  });

  it("does not let seeded demo escalations bury a new evaluation file", () => {
    const evaluation = rankDealPriority(
      deal({
        id: "eval-1",
        createdAt: "2026-08-29T15:00:00.000Z",
        dealReference: "PDR-APP-1A606C84",
        assignedProcessorId: null,
        status: "new",
      }),
      [need({ status: "rejected" })],
      [],
      [task()],
      now,
    );
    const seeded = rankDealPriority(
      deal({
        id: "demo-1",
        createdAt: "2026-08-20T10:00:00.000Z",
        dealReference: "PDR-SBX-004",
        status: "missing_items",
      }),
      [need({ dealId: "demo-1", status: "requested" })],
      [],
      [
        task({
          dealId: "demo-1",
          playbookKey: "prepare_submission",
          sourceType: "internal",
          dealContactId: "demo-contact",
          blockedReason: null,
          escalationLevel: "loan_officer",
          waitingSince: "2026-08-20T10:00:00.000Z",
        }),
      ],
      now,
    );
    expect(compareDealPriority(evaluation, seeded)).toBeLessThan(0);
  });
});
