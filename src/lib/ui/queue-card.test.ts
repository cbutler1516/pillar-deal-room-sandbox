import { describe, expect, it } from "vitest";
import { queueCardAccent, queueContextLine } from "@/lib/ui/queue-card";

describe("queue card presentation", () => {
  it("maps Queue Today sections to restrained accents", () => {
    expect(queueCardAccent("urgent")).toBe("urgent");
    expect(queueCardAccent("needs_review")).toBe("review");
    expect(queueCardAccent("waiting")).toBe("waiting");
    expect(queueCardAccent("new")).toBe("new");
    expect(queueCardAccent("due_today")).toBe("due");
  });

  it("joins loan type and location without repeating empties", () => {
    expect(
      queueContextLine({ loanType: "Fix & Flip", location: "Dallas, TX" }),
    ).toBe("Fix & Flip · Dallas, TX");
    expect(queueContextLine({ loanType: "DSCR", location: "—" })).toBe("DSCR");
    expect(queueContextLine({ loanType: null, location: null })).toBeNull();
  });
});
