import { describe, expect, it } from "vitest";
import { formatActivityClock, formatActivityDisplay } from "@/lib/ops/activity-display";

describe("activity display formatting", () => {
  it("formats who, did what, to what, and when", () => {
    const display = formatActivityDisplay(
      {
        eventType: "client_need_status_changed",
        actorType: "user",
        actorId: "user-1",
        createdAt: "2026-08-29T15:44:00.000Z",
        safeMetadata: {
          to: "rejected",
          document_type: "Government-issued ID",
        },
      },
      { "user-1": "Chris Butler" },
      new Date("2026-08-29T16:00:00.000Z"),
    );
    expect(display.who).toBe("Chris Butler");
    expect(display.didWhat).toBe("Requested replacement");
    expect(display.toWhat).toBe("Government-issued ID");
    expect(display.when).toMatch(/8:44|3:44|15:44|11:44/);
  });

  it("labels system actors and hides raw payloads", () => {
    const display = formatActivityDisplay({
      eventType: "contact_linked",
      actorType: "system",
      actorId: null,
      createdAt: "2026-08-29T15:36:00.000Z",
      safeMetadata: {
        contact_name: "Jordan Lee",
        contact_type: "insurance",
      },
    });
    expect(display.who).toBe("System");
    expect(display.didWhat).toMatch(/Linked Insurance contact/i);
    expect(display.toWhat).toBe("Jordan Lee");
    expect(display.didWhat).not.toMatch(/safe_metadata|event_type|\{/);
    expect(display.toWhat).not.toMatch(/contact_type=/);
  });

  it("labels an AI rewrite suggestion without implying a send", () => {
    const display = formatActivityDisplay({
      eventType: "ai_assist_requested",
      actorType: "user",
      actorId: "user-1",
      createdAt: "2026-08-31T18:00:00.000Z",
      safeMetadata: {
        capability: "rewrite_communication",
        outbound_sent: "false",
      },
    });
    expect(display.didWhat).toBe("Requested an AI rewrite suggestion");
    expect(display.didWhat).not.toMatch(/sent|approved|completed/i);
  });

  it("does not throw when the activity clock is invalid", () => {
    expect(formatActivityClock("", new Date("2026-08-31T18:00:00.000Z"))).toBe("—");
    expect(formatActivityClock("2026-08-31T18:00:00.000Z", new Date(Number.NaN))).toBe(
      "—",
    );
  });
});
