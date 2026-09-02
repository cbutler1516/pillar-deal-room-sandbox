import { describe, expect, it } from "vitest";
import {
  queueCardAccent,
  queueCardBody,
  queueContextLine,
  queueWorkCardLabel,
  workActionChipClass,
} from "@/lib/ui/queue-card";

describe("queue card presentation", () => {
  it("treats Escalate as a semantic chip and other actions as mineral text", () => {
    expect(workActionChipClass("Escalate")).toContain("text-danger");
    expect(workActionChipClass("Review document")).toContain("text-mineral");
    expect(workActionChipClass("Get replacement")).toContain("text-mineral");
  });

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

  it("does not repeat loan type or Unassigned on new-file cards", () => {
    expect(
      queueCardBody({
        title: "DSCR Purchase",
        reason: "Unassigned file",
        loanType: "DSCR Purchase",
        queueSection: "new",
        assigned: false,
        actionLabel: "Claim",
      }),
    ).toEqual({ workItem: "New unassigned file", reason: null });
    expect(
      queueCardBody({
        title: "Insurance",
        reason: "Follow-up is overdue",
        loanType: "Fix & Flip",
        queueSection: "urgent",
        assigned: true,
        actionLabel: "Escalate",
      }),
    ).toEqual({ workItem: "Insurance", reason: "Follow-up is overdue" });
  });
});
