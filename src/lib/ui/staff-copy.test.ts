import { describe, expect, it } from "vitest";
import {
  humanizeWorkAction,
  humanizeWorkReason,
  polishAssistSummary,
} from "@/lib/ui/staff-copy";

describe("staff copy", () => {
  it("rewrites Queue reasons into processor language", () => {
    expect(humanizeWorkReason("Replacement received")).toBe(
      "Replacement ready for review",
    );
    expect(humanizeWorkReason("Replacement needed")).toBe("Replacement still needed");
    expect(humanizeWorkReason("Escalation due")).toBe("Follow-up is overdue");
    expect(humanizeWorkReason("Unassigned file")).toBe("New unassigned file");
    expect(humanizeWorkReason("No initial contact with Jordan Lee")).toBe(
      "No request has been sent to Jordan Lee yet",
    );
    expect(humanizeWorkReason("Required item is missing")).toBe(
      "Required document is still missing",
    );
    expect(humanizeWorkReason("Response received from Title")).toBe(
      "Reply received from Title — review needed",
    );
    expect(humanizeWorkReason("Waiting on title")).toBe("Waiting for title");
    expect(humanizeWorkReason("Ready to submit")).toBe("Ready to send");
    expect(humanizeWorkReason("Waiting on a condition response")).toBe(
      "Waiting for a condition response",
    );
    expect(humanizeWorkReason("Follow-up due today")).toBe("Follow-up due today");
    expect(humanizeWorkReason("Document awaiting processor review")).toBe(
      "New document ready for review",
    );
  });

  it("maps CTAs to concrete actions without implying a send", () => {
    expect(
      humanizeWorkAction({
        recommendedAction: "Escalate",
        workType: "escalation_due",
      }),
    ).toBe("Follow up");
    expect(
      humanizeWorkAction({
        recommendedAction: "Escalate",
        workType: "escalated_task",
      }),
    ).toBe("Escalate");
    expect(
      humanizeWorkAction({
        recommendedAction: "Request replacement",
        workType: "replacement_needed",
      }),
    ).toBe("Get replacement");
    expect(
      humanizeWorkAction({
        recommendedAction: "Review",
        workType: "replacement_received",
        target: "documents",
      }),
    ).toBe("Review document");
    expect(
      humanizeWorkAction({
        recommendedAction: "Review",
        workType: "response_received",
        target: "tasks",
      }),
    ).toBe("Review reply");
    expect(
      humanizeWorkAction({
        recommendedAction: "Claim",
        workType: "unassigned_file",
      }),
    ).toBe("Claim file");
    expect(
      humanizeWorkAction({
        recommendedAction: "Contact",
        workType: "no_initial_contact",
        title: "Insurance binder",
      }),
    ).toBe("Contact insurance");
    expect(
      humanizeWorkAction({
        recommendedAction: "Collect",
        workType: "required_need_missing",
      }),
    ).toBe("View request");
    expect(
      humanizeWorkAction({
        recommendedAction: "Open",
        workType: "active_collection",
        target: "tasks",
      }),
    ).toBe("Review file");
    expect(
      humanizeWorkAction({
        recommendedAction: "Prepare submission",
        workType: "ready_to_submit",
        target: "submission",
      }),
    ).toBe("Prepare package");
  });

  it("removes robotic assist phrasing without changing facts", () => {
    expect(
      polishAssistSummary(
        "PDR-APP-1 is a Fix & Flip file in new. This is an assistive summary. It does not change the file.",
      ),
    ).toBe("PDR-APP-1 is a Fix & Flip new file.");
    expect(
      polishAssistSummary("The linked Client Need still needs a replacement."),
    ).toBe("The linked request still needs a replacement.");
  });
});
