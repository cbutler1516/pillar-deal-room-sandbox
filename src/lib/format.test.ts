import { describe, expect, it } from "vitest";
import {
  formatDealStatus,
  formatReceivedAt,
  formatStatusLabel,
  parseStaffInstant,
  staffCalendarDate,
  staffHour,
} from "@/lib/format";
import { formatLongDate } from "@/lib/ops/ops-board";

describe("status language", () => {
  it("never returns raw enum strings", () => {
    expect(formatStatusLabel("new")).toBe("New file");
    expect(formatStatusLabel("collecting_documents")).toBe("Collecting documents");
    expect(formatStatusLabel("processor_review")).toBe("In processor review");
    expect(formatDealStatus("ready_for_submission")).toBe("Ready to submit");
    expect(formatStatusLabel("waiting")).toBe("Waiting");
    expect(formatStatusLabel("replacement_needed")).toBe("Replacement needed");
    expect(formatStatusLabel("needs_review")).toBe("Needs review");
  });
});

describe("staff time zone", () => {
  it("formats received times in America/Los_Angeles regardless of host TZ", () => {
    expect(formatReceivedAt("2026-08-31T19:11:00.000Z")).toBe("Aug 31, 12:11 PM");
  });

  it("uses Pacific calendar date and hour for greeting/day grouping", () => {
    const eveningUtc = new Date("2026-08-31T19:11:00.000Z");
    expect(staffCalendarDate(eveningUtc)).toBe("2026-08-31");
    expect(staffHour(eveningUtc)).toBe(12);
    expect(formatLongDate(eveningUtc)).toBe("Monday, August 31, 2026");
  });

  it("parses staff instants and rejects invalid clocks", () => {
    expect(parseStaffInstant("2026-08-31T19:11:00.000Z")?.toISOString()).toBe(
      "2026-08-31T19:11:00.000Z",
    );
    expect(parseStaffInstant(Date.parse("2026-08-31T19:11:00.000Z"))?.toISOString()).toBe(
      "2026-08-31T19:11:00.000Z",
    );
    expect(parseStaffInstant("")).toBeNull();
    expect(parseStaffInstant("not-a-date")).toBeNull();
    expect(parseStaffInstant(new Date(Number.NaN))).toBeNull();
  });
});
