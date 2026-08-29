import { describe, expect, it } from "vitest";
import {
  assertDocumentProviderGuard,
  getDocumentStorageProviderName,
} from "@/lib/documents/config";
import { getDocumentStorageProvider } from "@/lib/documents/factory";

const sandboxEnv = {
  SANDBOX_MODE: "true",
  PRODUCTION_INTEGRATIONS_ENABLED: "false",
  DOCUMENT_STORAGE_PROVIDER: "sandbox_mock",
};

describe("provider selection guard", () => {
  it("selects sandbox_mock when the sandbox guard is valid", () => {
    expect(getDocumentStorageProviderName(sandboxEnv)).toBe("sandbox_mock");
    expect(getDocumentStorageProvider(sandboxEnv).name).toBe("sandbox_mock");
  });

  it("refuses any provider when SANDBOX_MODE is invalid", () => {
    expect(() =>
      getDocumentStorageProviderName({
        ...sandboxEnv,
        SANDBOX_MODE: "false",
      }),
    ).toThrow(/SANDBOX_MODE/);
  });

  it("refuses any provider when production integrations are enabled", () => {
    expect(() =>
      assertDocumentProviderGuard({
        ...sandboxEnv,
        PRODUCTION_INTEGRATIONS_ENABLED: "true",
      }),
    ).toThrow(/PRODUCTION_INTEGRATIONS_ENABLED/);
  });

  it("refuses production provider names", () => {
    expect(() =>
      getDocumentStorageProviderName({
        ...sandboxEnv,
        DOCUMENT_STORAGE_PROVIDER: "box",
      }),
    ).toThrow(/Production document providers/);
    expect(() =>
      getDocumentStorageProviderName({
        ...sandboxEnv,
        DOCUMENT_STORAGE_PROVIDER: "sharefile",
      }),
    ).toThrow(/Production document providers/);
    expect(() =>
      getDocumentStorageProviderName({
        ...sandboxEnv,
        DOCUMENT_STORAGE_PROVIDER: "dropbox_business",
      }),
    ).toThrow(/Production document providers/);
  });

  it("requires DOCUMENT_STORAGE_PROVIDER to be set", () => {
    expect(() =>
      getDocumentStorageProviderName({
        SANDBOX_MODE: "true",
        PRODUCTION_INTEGRATIONS_ENABLED: "false",
      }),
    ).toThrow(/DOCUMENT_STORAGE_PROVIDER/);
  });
});
