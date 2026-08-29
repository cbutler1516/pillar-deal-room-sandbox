import { describe, expect, it } from "vitest";
import { buildActivityEvent } from "@/lib/ops/workflow";
import {
  canCreateProcessorTask,
  canMutateProcessorTask,
  loanOfficerCanMutateTasks,
} from "@/lib/playbooks/authorization";

describe("processor ownership", () => {
  it("lets a processor mutate unassigned or own-deal tasks only", () => {
    expect(
      canMutateProcessorTask({
        role: "processor",
        userId: "proc-a",
        dealAssignedProcessorId: null,
        taskAssignedTo: null,
      }),
    ).toBe(true);
    expect(
      canMutateProcessorTask({
        role: "processor",
        userId: "proc-a",
        dealAssignedProcessorId: "proc-a",
        taskAssignedTo: "proc-a",
      }),
    ).toBe(true);
    expect(
      canMutateProcessorTask({
        role: "processor",
        userId: "proc-a",
        dealAssignedProcessorId: "proc-b",
        taskAssignedTo: null,
      }),
    ).toBe(false);
    expect(
      canMutateProcessorTask({
        role: "processor",
        userId: "proc-a",
        dealAssignedProcessorId: null,
        taskAssignedTo: "proc-b",
      }),
    ).toBe(false);
  });

  it("lets a processor create tasks only on eligible deals", () => {
    expect(
      canCreateProcessorTask({
        role: "processor",
        userId: "proc-a",
        dealAssignedProcessorId: null,
      }),
    ).toBe(true);
    expect(
      canCreateProcessorTask({
        role: "processor",
        userId: "proc-a",
        dealAssignedProcessorId: "proc-b",
      }),
    ).toBe(false);
    expect(
      canCreateProcessorTask({
        role: "admin",
        userId: "admin-1",
        dealAssignedProcessorId: "proc-b",
      }),
    ).toBe(true);
  });
});

describe("loan officer mutation denial", () => {
  it("denies loan officer task mutation while allowing read-oriented roles to be distinguished", () => {
    expect(loanOfficerCanMutateTasks("loan_officer")).toBe(false);
    expect(loanOfficerCanMutateTasks("processor")).toBe(true);
    expect(
      canMutateProcessorTask({
        role: "loan_officer",
        userId: "lo-1",
        dealAssignedProcessorId: null,
        taskAssignedTo: null,
      }),
    ).toBe(false);
    expect(
      canCreateProcessorTask({
        role: "loan_officer",
        userId: "lo-1",
        dealAssignedProcessorId: null,
      }),
    ).toBe(false);
  });
});

describe("task activity logging", () => {
  it("records safe playbook events without secrets", () => {
    const events = [
      "task_created",
      "task_started",
      "task_waiting",
      "task_follow_up_set",
      "task_completed",
      "task_escalated",
      "task_dismissed",
    ];
    for (const eventType of events) {
      const event = buildActivityEvent({
        eventType,
        actorId: "proc-a",
        metadata: {
          playbook_key: "request_bank_statements",
          ssn: "000-00-0000",
          token: "secret",
          access_url: "https://sandbox.invalid/view/secret",
        },
      });
      expect(event.eventType).toBe(eventType);
      expect(event.safeMetadata.playbook_key).toBe("request_bank_statements");
      expect(event.safeMetadata.ssn).toBeUndefined();
      expect(event.safeMetadata.token).toBeUndefined();
      expect(event.safeMetadata.access_url).toBeUndefined();
    }
  });
});
