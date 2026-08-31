import {
  assertDocumentIntelligenceGuard,
  getDocumentIntelligenceProviderName,
} from "@/lib/document-intelligence/config";
import { getSandboxMockDocumentIntelligenceProvider } from "@/lib/document-intelligence/mock-provider";
import {
  SANDBOX_MOCK_DOCUMENT_INTELLIGENCE_PROVIDER,
  type DocumentIntelligenceProvider,
} from "@/lib/document-intelligence/types";
import type { SandboxEnv } from "@/lib/sandbox";

export function getDocumentIntelligenceProvider(
  env: SandboxEnv = process.env,
): DocumentIntelligenceProvider {
  assertDocumentIntelligenceGuard(env);
  const name = getDocumentIntelligenceProviderName(env);
  if (name === SANDBOX_MOCK_DOCUMENT_INTELLIGENCE_PROVIDER) {
    return getSandboxMockDocumentIntelligenceProvider();
  }
  throw new Error("Unsupported document-intelligence provider.");
}
