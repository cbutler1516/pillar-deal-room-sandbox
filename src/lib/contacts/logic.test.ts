import { describe, expect, it } from "vitest";
import { assertSandboxGuard } from "@/lib/sandbox";
import { buildActivityEvent } from "@/lib/ops/workflow";
import {
  addContactLabel,
  contactActionChannel,
  contactsAfterMarkingPrimary,
  isSameDealContact,
  markTaskContactedPatch,
  markTaskWaitingPatch,
  pickContactForPlaybook,
  taskIsContactBlocked,
} from "@/lib/contacts/logic";
import { CONTACT_MISSING, contactTypeLabel } from "@/lib/contacts/types";
import { getPlaybook } from "@/lib/playbooks/registry";

describe("contact creation and primary behavior", () => {
  it("picks the primary contact of the expected type", () => {
    const playbook = getPlaybook("request_insurance_binder")!;
    const picked = pickContactForPlaybook(playbook, [
      {
        id: "other",
        contactType: "borrower",
        isPrimary: true,
        archivedAt: null,
      },
      {
        id: "ins",
        contactType: "insurance",
        isPrimary: true,
        archivedAt: null,
      },
    ]);
    expect(playbook.requiresContact).toBe(true);
    expect(playbook.contactType).toBe("insurance");
    expect(picked.contactId).toBe("ins");
    expect(picked.blockedReason).toBeNull();
  });

  it("normalizes one primary per type", () => {
    const next = contactsAfterMarkingPrimary(
      [
        { id: "a", contactType: "title", isPrimary: true },
        { id: "b", contactType: "title", isPrimary: false },
        { id: "c", contactType: "borrower", isPrimary: true },
      ],
      "b",
    );
    expect(next.find((row) => row.id === "a")?.isPrimary).toBe(false);
    expect(next.find((row) => row.id === "b")?.isPrimary).toBe(true);
    expect(next.find((row) => row.id === "c")?.isPrimary).toBe(true);
  });
});

describe("task-contact same-deal enforcement", () => {
  it("rejects a contact from another deal", () => {
    expect(isSameDealContact("deal-a", "deal-b")).toBe(false);
    expect(isSameDealContact("deal-a", "deal-a")).toBe(true);
    expect(isSameDealContact("deal-a", null)).toBe(false);
  });
});

describe("missing-contact workflow", () => {
  it("blocks a required-contact task until a contact is linked", () => {
    const playbook = getPlaybook("request_closing_protection_letter")!;
    const missing = pickContactForPlaybook(playbook, []);
    expect(missing.blockedReason).toBe(CONTACT_MISSING);
    expect(
      taskIsContactBlocked({
        requiresContact: true,
        dealContactId: null,
        blockedReason: CONTACT_MISSING,
      }),
    ).toBe(true);
    expect(
      taskIsContactBlocked({
        requiresContact: true,
        dealContactId: "contact-1",
        blockedReason: CONTACT_MISSING,
      }),
    ).toBe(false);
    expect(addContactLabel("insurance")).toBe("Add Insurance");
    expect(contactTypeLabel("co_borrower")).toBe("Co-borrower");
    expect(contactTypeLabel("property_manager")).toBe("Property manager");
  });

  it("does not require a contact for internal review", () => {
    const playbook = getPlaybook("review_bank_statements")!;
    expect(playbook.requiresContact).toBe(false);
    expect(pickContactForPlaybook(playbook, []).blockedReason).toBeNull();
  });
});

describe("mark contacted", () => {
  it("sets last contacted and next follow-up without sending anything", () => {
    const patch = markTaskContactedPatch({
      nowIso: "2026-08-28T18:00:00.000Z",
      followUpIntervalHours: 24,
      markWaiting: true,
    });
    expect(patch.last_contacted_at).toBe("2026-08-28T18:00:00.000Z");
    expect(patch.next_follow_up_at).toBe("2026-08-29T18:00:00.000Z");
    expect(patch.status).toBe("waiting");
    expect(contactActionChannel()).toEqual({ outboundSent: false, channel: null });
  });

  it("uses the source-type cadence when the task has no interval", () => {
    const patch = markTaskContactedPatch({
      nowIso: "2026-08-28T18:00:00.000Z",
      followUpIntervalHours: null,
      sourceType: "insurance",
      markWaiting: true,
    });
    expect(patch.next_follow_up_at).toBe("2026-08-29T18:00:00.000Z");
    expect(patch.last_contacted_at).toBe("2026-08-28T18:00:00.000Z");
  });

  it("sets waiting follow-up without fabricating last_contacted_at", () => {
    const patch = markTaskWaitingPatch({
      nowIso: "2026-08-28T18:00:00.000Z",
      followUpIntervalHours: null,
      sourceType: "contractor",
    });
    expect(patch.status).toBe("waiting");
    expect(patch.waiting_since).toBe("2026-08-28T18:00:00.000Z");
    expect(patch.next_follow_up_at).toBe("2026-08-30T18:00:00.000Z");
    expect(patch.completed_at).toBeNull();
    expect(patch).not.toHaveProperty("last_contacted_at");
  });
});

describe("activity and sandbox", () => {
  it("logs safe contact events without secrets", () => {
    const event = buildActivityEvent({
      eventType: "task_contacted",
      actorId: "proc-a",
      metadata: {
        outbound_sent: "false",
        ssn: "000-00-0000",
        token: "secret",
      },
    });
    expect(event.safeMetadata.outbound_sent).toBe("false");
    expect(event.safeMetadata.ssn).toBeUndefined();
  });

  it("keeps contact mutations inside the sandbox", () => {
    expect(() =>
      assertSandboxGuard({
        SANDBOX_MODE: "false",
        PRODUCTION_INTEGRATIONS_ENABLED: "false",
      }),
    ).toThrow(/SANDBOX_MODE/);
  });
});
