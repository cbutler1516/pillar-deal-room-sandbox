import { describe, expect, it } from "vitest";
import {
  APP_BOTTOM_NAV_SPACE,
  APP_HEADER_HEIGHT,
  DEAL_TABS_HEIGHT,
  dealTabsStickyClass,
  inspectorStickyClass,
} from "@/lib/ui/layout-chrome";

describe("layout chrome", () => {
  it("keeps inspector below header and deal tabs", () => {
    expect(APP_HEADER_HEIGHT).toBe("3.5rem");
    expect(DEAL_TABS_HEIGHT).toBe("2.75rem");
    expect(dealTabsStickyClass).toContain("top-[var(--app-header-height)]");
    expect(dealTabsStickyClass).toContain("z-10");
    expect(inspectorStickyClass).toContain("lg:top-[var(--inspector-sticky-top)]");
    expect(inspectorStickyClass).toContain("lg:z-0");
    expect(inspectorStickyClass).not.toMatch(/z-2[0-9]/);
  });

  it("reserves bottom nav space so inspector actions stay reachable", () => {
    expect(APP_BOTTOM_NAV_SPACE).toBe("8rem");
    expect(inspectorStickyClass).toContain(
      "lg:max-h-[calc(100vh-var(--inspector-sticky-top)-var(--app-bottom-nav-space))]",
    );
    expect(inspectorStickyClass).toContain("lg:overflow-y-auto");
  });
});
