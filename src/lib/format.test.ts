import { describe, expect, it } from "vitest";
import { formatDealStatus, formatStatusLabel } from "@/lib/format";

describe("status language", () => {
  it("never returns raw enum strings", () => {
    expect(formatStatusLabel("new")).toBe("New");
    expect(formatStatusLabel("collecting_documents")).toBe("Collecting documents");
    expect(formatStatusLabel("processor_review")).toBe("In review");
    expect(formatDealStatus("ready_for_submission")).toBe("Ready to submit");
    expect(formatStatusLabel("waiting")).toBe("Waiting");
    expect(formatStatusLabel("replacement_needed")).toBe("Replacement needed");
    expect(formatStatusLabel("needs_review")).toBe("Needs review");
  });
});
