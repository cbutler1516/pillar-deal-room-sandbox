import { assertSandboxGuard, getSandboxGuardError, type SandboxEnv } from "@/lib/sandbox";
import {
  SANDBOX_MOCK_DOCUMENT_INTELLIGENCE_PROVIDER,
  isDocumentIntelligenceProviderName,
  type DocumentIntelligenceProviderName,
} from "@/lib/document-intelligence/types";

export const DOCUMENT_INTELLIGENCE_PROVIDER_ENV = "DOCUMENT_INTELLIGENCE_PROVIDER";

const BLOCKED_PROVIDER_NAMES = [
  "ocr",
  "textract",
  "document_ai",
  "google_document_ai",
  "azure_form_recognizer",
  "azure_document_intelligence",
  "openai",
  "anthropic",
  "external_ocr",
  "external_document_intelligence",
];

export function getDocumentIntelligenceProviderName(
  env: SandboxEnv = process.env,
): DocumentIntelligenceProviderName {
  const guardError = getSandboxGuardError(env);
  if (guardError) {
    throw new Error(guardError);
  }

  const raw = env[DOCUMENT_INTELLIGENCE_PROVIDER_ENV]?.trim();
  const normalized = (
    raw || SANDBOX_MOCK_DOCUMENT_INTELLIGENCE_PROVIDER
  ).toLowerCase();

  if (BLOCKED_PROVIDER_NAMES.includes(normalized)) {
    throw new Error(
      "OCR and real document-intelligence providers are disabled. Set DOCUMENT_INTELLIGENCE_PROVIDER=sandbox_mock_document_intelligence.",
    );
  }

  if (isDocumentIntelligenceProviderName(normalized)) {
    return normalized;
  }

  throw new Error(
    "Only sandbox_mock_document_intelligence is allowed while PRODUCTION_INTEGRATIONS_ENABLED=false.",
  );
}

export function assertDocumentIntelligenceGuard(
  env: SandboxEnv = process.env,
): void {
  assertSandboxGuard(env);
  getDocumentIntelligenceProviderName(env);
}
