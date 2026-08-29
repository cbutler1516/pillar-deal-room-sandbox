import { describe, expect, it } from "vitest";
import {
  areProductionIntegrationsEnabled,
  assertSandboxGuard,
  getSandboxGuardError,
  isSandboxMode,
} from "@/lib/sandbox";

describe("sandbox guard", () => {
  it("requires SANDBOX_MODE=true", () => {
    expect(isSandboxMode({ SANDBOX_MODE: "true" })).toBe(true);
    expect(isSandboxMode({ SANDBOX_MODE: "false" })).toBe(false);
    expect(
      getSandboxGuardError({
        SANDBOX_MODE: "false",
        PRODUCTION_INTEGRATIONS_ENABLED: "false",
      }),
    ).toMatch(/SANDBOX_MODE/);
  });

  it("blocks production integrations", () => {
    expect(
      areProductionIntegrationsEnabled({
        PRODUCTION_INTEGRATIONS_ENABLED: "true",
      }),
    ).toBe(true);
    expect(
      getSandboxGuardError({
        SANDBOX_MODE: "true",
        PRODUCTION_INTEGRATIONS_ENABLED: "true",
      }),
    ).toMatch(/PRODUCTION_INTEGRATIONS_ENABLED/);
  });

  it("blocks production integration flags as a hard guard", () => {
    expect(
      getSandboxGuardError({
        SANDBOX_MODE: "true",
        PRODUCTION_INTEGRATIONS_ENABLED: "true",
      }),
    ).toMatch(/disabled/);
  });

  it("allows the sandbox configuration", () => {
    expect(() =>
      assertSandboxGuard({
        SANDBOX_MODE: "true",
        PRODUCTION_INTEGRATIONS_ENABLED: "false",
      }),
    ).not.toThrow();
  });
});
