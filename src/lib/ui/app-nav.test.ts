import { describe, expect, it } from "vitest";
import {
  DESKTOP_APP_NAV,
  MOBILE_APP_NAV,
  isAppNavActive,
} from "@/lib/ui/app-nav";

describe("app navigation", () => {
  it("keeps Tasks on desktop only and uses the existing /tasks route", () => {
    expect(MOBILE_APP_NAV.map((item) => item.label)).toEqual([
      "Dashboard",
      "Deals",
      "Queue",
    ]);
    expect(DESKTOP_APP_NAV.map((item) => item.label)).toEqual([
      "Dashboard",
      "Deals",
      "Queue",
      "Tasks",
      "Team",
    ]);
    expect(DESKTOP_APP_NAV.at(-1)).toEqual({ href: "/team", label: "Team" });
    expect(MOBILE_APP_NAV.map((item) => item.href)).toEqual([
      "/dashboard",
      "/deals",
      "/processor-queue",
    ]);
  });

  it("marks Tasks active on /tasks without inventing extra destinations", () => {
    expect(isAppNavActive("/tasks", "/tasks")).toBe(true);
    expect(isAppNavActive("/dashboard", "/tasks")).toBe(false);
    expect(isAppNavActive("/deals/abc", "/deals")).toBe(true);
    expect(DESKTOP_APP_NAV.map((item) => item.href)).not.toEqual(
      expect.arrayContaining(["/reports", "/settings"]),
    );
  });
});
