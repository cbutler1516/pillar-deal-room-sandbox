import { describe, expect, it } from "vitest";
import {
  buildActivityEvent,
  canClaimDeal,
  canProcessorTouchAssignment,
  canUnclaimDeal,
  evaluateSubmissionReadiness,
  sanitizeActivityMetadata,
} from "@/lib/ops/workflow";

describe("claim rules", () => {
  it("lets a processor claim only an unassigned deal", () => {
    expect(canClaimDeal(null, "proc-a", "processor")).toBe(true);
    expect(canClaimDeal("proc-b", "proc-a", "processor")).toBe(false);
    expect(canClaimDeal("proc-b", "proc-a", "admin")).toBe(false);
  });

  it("blocks claiming another processor's assigned deal", () => {
    expect(
      canProcessorTouchAssignment("proc-b", "proc-a", "proc-a"),
    ).toBe(false);
    expect(canProcessorTouchAssignment(null, "proc-a", "proc-a")).toBe(true);
    expect(canProcessorTouchAssignment(null, "proc-b", "proc-a")).toBe(false);
  });

  it("lets a processor unclaim only their own deal", () => {
    expect(canUnclaimDeal("proc-a", "proc-a", "processor")).toBe(true);
    expect(canUnclaimDeal("proc-b", "proc-a", "processor")).toBe(false);
  });
});

describe("client need and task mutation authorization", () => {
  it("does not let a loan officer claim or unclaim", () => {
    expect(canClaimDeal(null, "lo-1", "loan_officer")).toBe(false);
    expect(canUnclaimDeal("lo-1", "lo-1", "loan_officer")).toBe(false);
  });
});

describe("activity logging", () => {
  it("keeps only safe metadata keys", () => {
    expect(
      sanitizeActivityMetadata({
        from: "new",
        to: "missing_items",
        external_file_id: "sandbox-demo-document-001",
        ssn: "000-00-0000",
        token: "sess_secret",
        access_url: "https://sandbox.invalid/view/secret",
      }),
    ).toEqual({ from: "new", to: "missing_items" });
  });

  it("builds a user activity event", () => {
    const event = buildActivityEvent({
      eventType: "deal_claimed",
      actorId: "user-1",
      metadata: { to: "user-1" },
    });
    expect(event.actorType).toBe("user");
    expect(event.safeMetadata.to).toBe("user-1");
  });
});

describe("submission readiness", () => {
  it("blocks Ready for Submission until required needs are approved or waived", () => {
    const blocked = evaluateSubmissionReadiness({
      needs: [
        { required: true, status: "received" },
        { required: true, status: "requested" },
        { required: false, status: "requested" },
      ],
    });
    expect(blocked.ready).toBe(false);
    expect(blocked.blockers[0]).toMatch(/required Client Need/);

    const ready = evaluateSubmissionReadiness({
      needs: [
        { required: true, status: "approved" },
        { required: true, status: "waived" },
        { required: false, status: "requested" },
      ],
      tasks: [{ status: "open", blockedReason: null }],
    });
    expect(ready.ready).toBe(true);
    expect(ready.blockers).toEqual([]);
  });

  it("blocks Ready for Submission when a required contact is still missing", () => {
    const blocked = evaluateSubmissionReadiness({
      needs: [{ required: true, status: "approved" }],
      tasks: [{ status: "open", blockedReason: "contact_missing" }],
    });
    expect(blocked.ready).toBe(false);
    expect(blocked.blockers.some((item) => /contacts/.test(item))).toBe(true);
  });
});

describe("task completion", () => {
  it("treats completed as a valid mutation target", () => {
    const event = buildActivityEvent({
      eventType: "task_completed",
      actorId: "user-1",
      metadata: { from: "open", to: "completed" },
    });
    expect(event.eventType).toBe("task_completed");
    expect(event.safeMetadata.to).toBe("completed");
  });
});
