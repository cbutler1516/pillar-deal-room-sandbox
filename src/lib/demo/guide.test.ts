import { describe, expect, it } from "vitest";
import { canShowDemoGuide } from "@/lib/demo/guide";

describe("demo guide visibility", () => {
  it("stays hidden outside sandbox", () => {
    expect(
      canShowDemoGuide({
        SANDBOX_MODE: "false",
        PRODUCTION_INTEGRATIONS_ENABLED: "false",
      }),
    ).toBe(false);
    expect(
      canShowDemoGuide({
        SANDBOX_MODE: "true",
        PRODUCTION_INTEGRATIONS_ENABLED: "false",
      }),
    ).toBe(true);
  });
});
