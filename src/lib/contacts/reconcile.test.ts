import { describe, expect, it } from "vitest";
import { contactActionChannel } from "@/lib/contacts/logic";
import {
  pickActiveContactForType,
  reconcileBlockedTasksForContact,
} from "@/lib/contacts/reconcile";
import { CONTACT_MISSING } from "@/lib/contacts/types";

const joe = {
  id: "joe",
  contactType: "insurance",
  name: "Joe Smith",
  email: "joe@sandbox-insure.example",
  phone: "555-0101",
  isPrimary: true,
  archivedAt: null,
};

const binderTask = {
  id: "binder",
  status: "open",
  playbookKey: "request_insurance_binder",
  sourceType: "insurance",
  dealContactId: null,
  blockedReason: CONTACT_MISSING,
};

describe("blocked-task reconciliation", () => {
  it("links a blocked insurance binder task to the primary insurance contact", () => {
    const patches = reconcileBlockedTasksForContact({
      contactType: "insurance",
      contacts: [joe],
      tasks: [binderTask],
    });
    expect(patches).toEqual([
      {
        taskId: "binder",
        dealContactId: "joe",
        contactName: "Joe Smith",
        contactEmail: "joe@sandbox-insure.example",
        contactPhone: "555-0101",
      },
    ]);
  });

  it("prefers the primary contact when several insurance contacts exist", () => {
    const patches = reconcileBlockedTasksForContact({
      contactType: "insurance",
      contacts: [
        {
          ...joe,
          id: "first",
          name: "First Agent",
          isPrimary: false,
        },
        joe,
      ],
      tasks: [binderTask],
    });
    expect(patches[0]?.dealContactId).toBe("joe");
    expect(pickActiveContactForType("insurance", [
      { ...joe, id: "first", isPrimary: false },
      joe,
    ])?.id).toBe("joe");
  });

  it("uses the first active contact when no primary exists", () => {
    const patches = reconcileBlockedTasksForContact({
      contactType: "insurance",
      contacts: [{ ...joe, isPrimary: false }],
      tasks: [binderTask],
    });
    expect(patches[0]?.dealContactId).toBe("joe");
  });

  it("does not link a title contact to an insurance task", () => {
    const patches = reconcileBlockedTasksForContact({
      contactType: "title",
      contacts: [
        {
          id: "title-1",
          contactType: "title",
          name: "Taylor Reed",
          email: null,
          phone: null,
          isPrimary: true,
          archivedAt: null,
        },
      ],
      tasks: [binderTask],
    });
    expect(patches).toEqual([]);
  });

  it("leaves completed and dismissed tasks unchanged", () => {
    const patches = reconcileBlockedTasksForContact({
      contactType: "insurance",
      contacts: [joe],
      tasks: [
        { ...binderTask, id: "done", status: "completed" },
        { ...binderTask, id: "gone", status: "dismissed" },
      ],
    });
    expect(patches).toEqual([]);
  });

  it("does not retarget a task that already has a contact", () => {
    const patches = reconcileBlockedTasksForContact({
      contactType: "insurance",
      contacts: [joe],
      tasks: [{ ...binderTask, dealContactId: "already" }],
    });
    expect(patches).toEqual([]);
  });

  it("does not touch internal review tasks", () => {
    const patches = reconcileBlockedTasksForContact({
      contactType: "insurance",
      contacts: [joe],
      tasks: [
        {
          id: "review",
          status: "open",
          playbookKey: "review_bank_statements",
          sourceType: "internal",
          dealContactId: null,
          blockedReason: CONTACT_MISSING,
        },
      ],
    });
    expect(patches).toEqual([]);
  });

  it("unblocks waiting and in-progress insurance tasks", () => {
    const patches = reconcileBlockedTasksForContact({
      contactType: "insurance",
      contacts: [joe],
      tasks: [
        { ...binderTask, id: "wait", status: "waiting" },
        { ...binderTask, id: "work", status: "in_progress" },
      ],
    });
    expect(patches.map((row) => row.taskId).sort()).toEqual(["wait", "work"]);
  });

  it("does not send outbound communication", () => {
    expect(contactActionChannel()).toEqual({ outboundSent: false, channel: null });
  });
});
