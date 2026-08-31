import { analyzeDocumentIntelligence } from "@/lib/document-intelligence/analyze";
import {
  SANDBOX_MOCK_DOCUMENT_INTELLIGENCE_PROVIDER,
  type DocumentIntelligenceProvider,
  type DocumentIntelligenceSnapshot,
} from "@/lib/document-intelligence/types";

export function getSandboxMockDocumentIntelligenceProvider(): DocumentIntelligenceProvider {
  return {
    name: SANDBOX_MOCK_DOCUMENT_INTELLIGENCE_PROVIDER,
    async analyze(snapshot: DocumentIntelligenceSnapshot) {
      return analyzeDocumentIntelligence(snapshot);
    },
  };
}
