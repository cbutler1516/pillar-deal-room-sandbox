import { describe, expect, it } from "vitest";
import {
  buildDealTimeline,
  filterTimelineEntries,
  groupTimelineByDay,
  timelineKindForEvent,
} from "@/lib/ops/timeline";

describe("deal timeline", () => {
  it("classifies activity without exposing raw event names", () => {
    expect(timelineKindForEvent("document_metadata_recorded")).toBe("documents");
    expect(timelineKindForEvent("task_contacted")).toBe("communications");
    expect(timelineKindForEvent("deal_status_changed")).toBe("workflow");
  });

  it("merges activity and communications into human day groups", () => {
    const now = new Date("2026-08-31T18:00:00.000Z");
    const entries = buildDealTimeline({
      now,
      staffNames: { "user-1": "Chris Butler" },
      contacts: [
        {
          id: "c1",
          dealId: "d1",
          contactType: "insurance",
          name: "Jordan Lee",
          company: "Harbor",
          email: "jordan@example.com",
          phone: null,
          notes: null,
          isPrimary: true,
          archivedAt: null,
        },
      ],
      activity: [
        {
          id: "a1",
          dealId: "d1",
          eventType: "client_need_status_changed",
          actorType: "user",
          actorId: "user-1",
          createdAt: "2026-08-31T17:42:00.000Z",
          safeMetadata: { to: "rejected", document_type: "Government-issued ID" },
        },
      ],
      attempts: [
        {
          id: "comm-1",
          dealId: "d1",
          taskId: "t1",
          clientNeedId: "n1",
          dealContactId: "c1",
          direction: "outbound",
          channel: "email",
          status: "contacted",
          subject: "Insurance Binder",
          bodySnapshot: "Checking in",
          attemptedAt: "2026-08-31T18:05:00.000Z",
          createdBy: "user-1",
          outboundSent: false,
          draftType: "initial",
          audience: "internal",
          sandboxSimulated: false,
        },
      ],
    });
    expect(entries[0].actor).toBe("Chris Butler → Jordan Lee");
    expect(entries[0].action).toBe("Contacted");
    expect(entries[0].context).toMatch(/Insurance Binder/);
    expect(entries[1].action).toBe("Document marked rejected");
    expect(filterTimelineEntries(entries, "communications")).toHaveLength(1);
    expect(groupTimelineByDay(entries, now)[0].label).toBe("Today");
  });

  it("skips invalid timestamps instead of crashing day groups", () => {
    const now = new Date("2026-08-31T18:00:00.000Z");
    expect(() =>
      groupTimelineByDay(
        [
          {
            id: "bad",
            at: "",
            actor: "Staff",
            action: "Recorded activity",
            target: null,
            context: null,
            kind: "workflow",
            detail: null,
            simulated: false,
          },
          {
            id: "ok",
            at: "2026-08-31T17:42:00.000Z",
            actor: "Chris Butler",
            action: "Requested replacement",
            target: null,
            context: null,
            kind: "workflow",
            detail: null,
            simulated: false,
          },
        ],
        now,
      ),
    ).not.toThrow();
    const days = groupTimelineByDay(
      [
        {
          id: "ok",
          at: "2026-08-31T17:42:00.000Z",
          actor: "Chris Butler",
          action: "Requested replacement",
          target: null,
          context: null,
          kind: "workflow",
          detail: null,
          simulated: false,
        },
      ],
      new Date(Number.NaN),
    );
    expect(days[0]?.key).toBe("2026-08-31");
  });
});
