import { describe, expect, it } from "vitest";
import {
  portalNeedAction,
  portalNeedExplanation,
  portalNeedGroup,
  portalNeedStatusLabel,
  portalProgressStep,
  portalReceivedCopy,
} from "@/lib/portal/presentation";

const base = {
  id: "n1",
  documentType: "Government-issued ID",
  description: "Please provide a current government-issued ID.",
  required: true,
  timing: "required_now" as const,
  documentCount: 0,
  expectedDocumentCount: 1,
};

describe("borrower portal need grouping", () => {
  it("groups missing and replacement into Action needed", () => {
    expect(portalNeedGroup({ ...base, status: "missing" })).toBe("action_needed");
    expect(portalNeedGroup({ ...base, status: "rejected" })).toBe("action_needed");
    expect(portalNeedGroup({ ...base, status: "requested" })).toBe("action_needed");
  });

  it("groups received and review into Under review", () => {
    expect(portalNeedGroup({ ...base, status: "received", documentCount: 1 })).toBe(
      "under_review",
    );
    expect(portalNeedGroup({ ...base, status: "needs_review", documentCount: 2 })).toBe(
      "under_review",
    );
  });

  it("keeps later items out of action until they are due", () => {
    expect(
      portalNeedGroup({
        ...base,
        status: "requested",
        timing: "required_later",
      }),
    ).toBe("required_later");
    expect(portalNeedGroup({ ...base, status: "approved" })).toBe("complete");
  });
});

describe("borrower portal copy", () => {
  it("uses short explanations and honest CTAs", () => {
    expect(portalNeedStatusLabel("rejected")).toBe("Replacement needed");
    expect(portalNeedExplanation({ ...base, status: "rejected" })).toContain(
      "could not be accepted",
    );
    expect(portalNeedAction({ ...base, status: "rejected" })).toBe(
      "Upload replacement",
    );
    expect(
      portalNeedAction({ ...base, status: "needs_review", documentCount: 2 }),
    ).toBeNull();
    expect(
      portalReceivedCopy({
        ...base,
        status: "needs_review",
        documentCount: 2,
        expectedDocumentCount: 2,
      }),
    ).toBe("2 of 2 received");
  });
});

describe("borrower portal progress", () => {
  it("uses Need state only and never claims loan approval", () => {
    expect(
      portalProgressStep([{ required: true, status: "missing", timing: "required_now" }]),
    ).toBe("requested");
    expect(
      portalProgressStep([
        { required: true, status: "received", timing: "required_now" },
        { required: true, status: "missing", timing: "required_now" },
      ]),
    ).toBe("received");
    expect(
      portalProgressStep([
        { required: true, status: "needs_review", timing: "required_now" },
      ]),
    ).toBe("review");
    expect(
      portalProgressStep([
        { required: true, status: "approved", timing: "required_now" },
        { required: true, status: "waived", timing: "required_now" },
      ]),
    ).toBe("ready");
  });
});
