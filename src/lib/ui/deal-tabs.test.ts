import { describe, expect, it } from "vitest";
import { DEAL_TAB_NAV } from "@/components/deal-workspace";

describe("deal workspace tabs", () => {
  it("keeps existing query keys while using processor-facing labels", () => {
    expect(DEAL_TAB_NAV.map((item) => item.label)).toEqual([
      "Overview",
      "Requests",
      "Documents",
      "Conditions",
      "Submission",
      "People",
      "Activity",
    ]);
    expect(DEAL_TAB_NAV.find((item) => item.label === "Requests")?.tab).toBe("needs");
    expect(DEAL_TAB_NAV.find((item) => item.label === "Activity")?.tab).toBe(
      "timeline",
    );
    expect(DEAL_TAB_NAV.find((item) => item.label === "People")?.tab).toBe("people");
  });
});
