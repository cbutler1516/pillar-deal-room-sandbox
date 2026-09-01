import { describe, expect, it } from "vitest";
import { humanizeWorkReason, polishAssistSummary } from "@/lib/ui/staff-copy";

describe("staff copy", () => {
  it("rewrites Queue reasons into processor language", () => {
    expect(humanizeWorkReason("Replacement received")).toBe(
      "Replacement document ready for review",
    );
    expect(humanizeWorkReason("No initial contact with Jordan Lee")).toBe(
      "No request has been sent to Jordan Lee yet",
    );
    expect(humanizeWorkReason("Required item is missing")).toBe(
      "Required document is still missing",
    );
    expect(humanizeWorkReason("Response received from Title")).toBe(
      "Reply received from Title — review needed",
    );
    expect(humanizeWorkReason("Follow-up due today")).toBe("Follow-up due today");
  });

  it("removes robotic assist phrasing without changing facts", () => {
    expect(
      polishAssistSummary(
        "PDR-APP-1 is a Fix & Flip file in new. This is an assistive summary. It does not change the file.",
      ),
    ).toBe("PDR-APP-1 is a Fix & Flip new file.");
  });
});
