import { assertSandboxGuard, getSandboxGuardError, type SandboxEnv } from "@/lib/sandbox";
import {
  DOCUMENT_STORAGE_PROVIDERS,
  SANDBOX_MOCK_PROVIDER,
  SHAREFILE_PROVIDER,
  type DocumentStorageProviderName,
} from "@/lib/documents/types";

/**
 * Env-driven provider selection.
 * Allowed sandbox values: sandbox_mock | sharefile.
 * sharefile still requires SANDBOX_MODE=true and
 * PRODUCTION_INTEGRATIONS_ENABLED=false.
 */
export const DOCUMENT_STORAGE_PROVIDER_ENV = "DOCUMENT_STORAGE_PROVIDER";

const BLOCKED_PRODUCTION_PROVIDER_NAMES = [
  "box",
  "dropbox",
  "dropbox_business",
  "dropbox-business",
  "supabase",
  "supabase_storage",
  "s3",
  "gcs",
  "azure_blob",
];

export function getDocumentStorageProviderName(
  env: SandboxEnv = process.env,
): DocumentStorageProviderName {
  const guardError = getSandboxGuardError(env);
  if (guardError) {
    throw new Error(guardError);
  }

  const raw = env[DOCUMENT_STORAGE_PROVIDER_ENV]?.trim();
  if (!raw) {
    throw new Error(
      "DOCUMENT_STORAGE_PROVIDER must be set to sandbox_mock or sharefile in this sandbox.",
    );
  }

  const normalized = raw.toLowerCase();
  if (BLOCKED_PRODUCTION_PROVIDER_NAMES.includes(normalized)) {
    throw new Error(
      "Production document providers are disabled. Only sandbox_mock or sharefile is allowed.",
    );
  }

  if (normalized === SANDBOX_MOCK_PROVIDER) {
    return SANDBOX_MOCK_PROVIDER;
  }
  if (normalized === SHAREFILE_PROVIDER) {
    return SHAREFILE_PROVIDER;
  }

  throw new Error(
    "Only sandbox_mock or sharefile is allowed while PRODUCTION_INTEGRATIONS_ENABLED=false.",
  );
}

export function assertDocumentProviderGuard(env: SandboxEnv = process.env): void {
  assertSandboxGuard(env);
  getDocumentStorageProviderName(env);
}

export function isAllowedDocumentStorageProvider(
  name: string,
): name is DocumentStorageProviderName {
  return (DOCUMENT_STORAGE_PROVIDERS as readonly string[]).includes(name);
}
