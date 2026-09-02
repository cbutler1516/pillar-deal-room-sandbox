import { describe, expect, it } from "vitest";
import { statusTone } from "@/components/status-chip";

describe("V4 status vocabulary", () => {
  it("maps deal and item statuses onto the six semantic tones", () => {
    expect(statusTone("new")).toBe("neutral");
    expect(statusTone("missing_items")).toBe("warning");
    expect(statusTone("needs_review")).toBe("info");
    expect(statusTone("waiting")).toBe("waiting");
    expect(statusTone("rejected")).toBe("danger");
    expect(statusTone("ready_for_submission")).toBe("success");
  });

  it("falls back to neutral for unknown statuses instead of inventing colour", () => {
    expect(statusTone("some_future_status")).toBe("neutral");
    expect(statusTone("")).toBe("neutral");
  });

  it("keeps replacement and withdrawal in the danger tone", () => {
    expect(statusTone("replacement_needed")).toBe("danger");
    expect(statusTone("withdrawn")).toBe("danger");
  });
});
