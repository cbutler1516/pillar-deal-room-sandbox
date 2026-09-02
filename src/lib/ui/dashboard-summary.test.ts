import { describe, expect, it } from "vitest";
import { formatDashboardSummary } from "@/lib/ui/dashboard-summary";

describe("dashboard summary copy", () => {
  it("uses Queue Truth counts with natural pluralization", () => {
    expect(
      formatDashboardSummary({
        needsAttention: 8,
        docsToReview: 12,
        ready: 1,
      }),
    ).toEqual({
      attention: "8 files need your attention today",
      review: "12 documents ready for review",
      ready: "1 ready to send",
      line: "8 files need attention · 12 documents to review · 1 ready to send",
    });
    expect(
      formatDashboardSummary({
        needsAttention: 1,
        docsToReview: 1,
        ready: 0,
      }),
    ).toEqual({
      attention: "1 file needs your attention today",
      review: "1 document ready for review",
      ready: "0 ready to send",
      line: "1 file needs attention · 1 document to review · 0 ready to send",
    });
  });
});
