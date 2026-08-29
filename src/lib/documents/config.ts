import { assertSandboxGuard, getSandboxGuardError, type SandboxEnv } from "@/lib/sandbox";
import {
  DOCUMENT_STORAGE_PROVIDERS,
  SANDBOX_MOCK_PROVIDER,
  type DocumentStorageProviderName,
} from "@/lib/documents/types";

/**
 * Env-driven provider selection.
 * DOCUMENT_STORAGE_PROVIDER=sandbox_mock is the only allowed value in this
 * repository. Production vendors (ShareFile, Box, Dropbox, etc.) must not be
 * configured or credentialed here.
 *
 * The selector refuses any provider when the sandbox guard is invalid.
 */
export const DOCUMENT_STORAGE_PROVIDER_ENV = "DOCUMENT_STORAGE_PROVIDER";

const BLOCKED_PRODUCTION_PROVIDER_NAMES = [
  "box",
  "sharefile",
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
      "DOCUMENT_STORAGE_PROVIDER must be set to sandbox_mock in this sandbox.",
    );
  }

  const normalized = raw.toLowerCase();
  if (BLOCKED_PRODUCTION_PROVIDER_NAMES.includes(normalized)) {
    throw new Error(
      "Production document providers are disabled. Only sandbox_mock is allowed.",
    );
  }

  if (normalized !== SANDBOX_MOCK_PROVIDER) {
    throw new Error(
      "Only sandbox_mock is allowed while PRODUCTION_INTEGRATIONS_ENABLED=false.",
    );
  }

  return SANDBOX_MOCK_PROVIDER;
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
