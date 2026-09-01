import { describe, expect, it } from "vitest";
import {
  queueCardAccent,
  queueContextLine,
  queueWorkCardLabel,
} from "@/lib/ui/queue-card";

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

  it("builds one navigation label for the whole work card", () => {
    expect(
      queueWorkCardLabel({
        borrowerName: "Casey Nguyen",
        title: "Review insurance binder",
        reason: "Document awaiting review",
        actionLabel: "Review",
        ownerName: null,
      }),
    ).toBe(
      "Casey Nguyen. Review insurance binder. Document awaiting review. Unassigned. Review",
    );
    expect(
      queueWorkCardLabel({
        borrowerName: "Avery Quinn",
        title: "Follow up",
        reason: "Waiting on title",
        actionLabel: "Open",
        ownerName: "Chris Butler",
      }),
    ).toContain("Chris Butler");
  });
});
