import { describe, expect, it } from "vitest";
import {
  boardColumnForStatus,
  computeOpsMetrics,
  firstNameFromProfile,
  greetingForHour,
  matchesTaskQuery,
  taskSearchHaystack,
  waitingBucket,
  waitingCounts,
} from "@/lib/ops/ops-board";

describe("ops board presentation", () => {
  it("greets from the current hour and uses the signed-in first name", () => {
    expect(greetingForHour(8)).toBe("Good morning");
    expect(greetingForHour(14)).toBe("Good afternoon");
    expect(greetingForHour(19)).toBe("Good evening");
    expect(
      firstNameFromProfile({ fullName: "Chris Butler", email: "c@sandbox.example" }),
    ).toBe("Chris");
    expect(
      firstNameFromProfile({ fullName: null, email: "processor@sandbox.example" }),
    ).toBe("processor");
  });

  it("maps task status to board columns and excludes dismissed", () => {
    expect(boardColumnForStatus("open")).toBe("todo");
    expect(boardColumnForStatus("in_progress")).toBe("in_progress");
    expect(boardColumnForStatus("waiting")).toBe("waiting");
    expect(boardColumnForStatus("completed")).toBe("done");
    expect(boardColumnForStatus("dismissed")).toBeNull();
  });

  it("computes operational metrics from ranked tasks without changing deal counts", () => {
    expect(
      computeOpsMetrics({
        newDeals: 1,
        documentsToReview: 3,
        readyForSubmission: 1,
        ranked: [
          {
            timing: "required_now",
            followUpDue: true,
            escalationDue: true,
            status: "waiting",
            sourceType: "borrower",
          },
          {
            timing: "required_now",
            followUpDue: false,
            escalationDue: false,
            status: "waiting",
            sourceType: "insurance",
          },
          {
            timing: "required_later",
            followUpDue: false,
            escalationDue: false,
            status: "open",
            sourceType: "internal",
          },
        ],
      }),
    ).toEqual({
      newDeals: 1,
      requiredNow: 2,
      followUpsDue: 1,
      documentsToReview: 3,
      waitingOnBorrower: 1,
      waitingOnThirdParty: 1,
      readyForSubmission: 1,
      escalations: 1,
    });
  });

  it("groups waiting work and matches operational search text", () => {
    expect(waitingBucket("title")).toBe("title");
    expect(
      waitingCounts([
        { status: "waiting", sourceType: "borrower" },
        { status: "waiting", sourceType: "appraiser" },
        { status: "open", sourceType: "borrower" },
      ]),
    ).toEqual({ borrower: 1, title: 0, insurance: 0, other: 1 });
    expect(
      matchesTaskQuery(
        taskSearchHaystack({
          borrowerName: "Avery Quinn",
          dealReference: "PDR-SANDBOX-003",
          title: "Request insurance binder",
        }),
        "insurance",
      ),
    ).toBe(true);
  });
});
