import { assertDocumentProviderGuard, getDocumentStorageProviderName } from "@/lib/documents/config";
import { getSandboxMockProvider } from "@/lib/documents/mock-provider";
import type { DocumentStorageProvider } from "@/lib/documents/types";
import type { SandboxEnv } from "@/lib/sandbox";

/**
 * Returns the configured storage adapter.
 * Provider-specific types stay inside the adapter layer.
 * Production vendors are not constructed here.
 */
export function getDocumentStorageProvider(
  env: SandboxEnv = process.env,
): DocumentStorageProvider {
  assertDocumentProviderGuard(env);
  const name = getDocumentStorageProviderName(env);
  if (name === "sandbox_mock") {
    return getSandboxMockProvider();
  }
  throw new Error("Unsupported document storage provider.");
}
