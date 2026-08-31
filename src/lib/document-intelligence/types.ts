export const SANDBOX_MOCK_DOCUMENT_INTELLIGENCE_PROVIDER =
  "sandbox_mock_document_intelligence" as const;

export const DOCUMENT_INTELLIGENCE_PROVIDERS = [
  SANDBOX_MOCK_DOCUMENT_INTELLIGENCE_PROVIDER,
] as const;

export type DocumentIntelligenceProviderName =
  (typeof DOCUMENT_INTELLIGENCE_PROVIDERS)[number];

export const DOCUMENT_INTELLIGENCE_DISCLAIMER =
  "Metadata-only suggestion. A processor still has to review this file. Nothing was approved, rejected, or sent.";

export type DocumentClassificationSuggestion = {
  documentId: string;
  suggestedType: string | null;
  confidence: number;
  reasons: string[];
  source: "filename" | "linked_need" | "manual_type" | "unknown";
};

export type DocumentNeedFitStatus =
  | "fit"
  | "candidate"
  | "mismatch"
  | "unlinked"
  | "unknown";

export type DocumentNeedFitResult = {
  documentId: string;
  needId: string;
  needDocumentType: string;
  status: DocumentNeedFitStatus;
  linked: boolean;
  reasons: string[];
};

export type DocumentDuplicateFlag = {
  documentId: string;
  otherDocumentId: string;
  otherFileName: string;
  kind: "same_filename" | "same_stem" | "same_type_and_period";
  severity: "info" | "warning";
  reasons: string[];
};

export type DocumentPeriodFlag = {
  documentId: string;
  extractedPeriod: string | null;
  kind: "readable" | "missing" | "duplicate_period" | "gap";
  severity: "info" | "warning";
  reasons: string[];
};

export type DocumentSetCompleteness = {
  needId: string;
  documentType: string;
  required: boolean;
  expectedCount: number | null;
  linkedCount: number;
  approvedCount: number;
  pendingCount: number;
  countMet: boolean;
  processorDecisionRequired: boolean;
  summary: string;
};

export type DocumentReviewAction =
  | "confirm_type"
  | "link_need"
  | "review_duplicate"
  | "review_period"
  | "review_mismatch"
  | "review_unclassified"
  | "processor_decision";

export type DocumentReviewRecommendation = {
  documentId: string;
  fileName: string;
  action: DocumentReviewAction;
  label: string;
  reasons: string[];
  priority: number;
  href: string;
  executable: false;
};

export type DocumentIntelligenceDocumentResult = {
  documentId: string;
  classification: DocumentClassificationSuggestion;
  needFit: DocumentNeedFitResult[];
  duplicates: DocumentDuplicateFlag[];
  period: DocumentPeriodFlag | null;
  recommendation: DocumentReviewRecommendation;
};

export type DocumentIntelligenceDeal = {
  dealId: string;
  loanType: string | null;
  propertyType: string | null;
  transaction: string | null;
  loanPurpose: string | null;
};

export type DocumentIntelligenceDocument = {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  documentType: string | null;
  status: string;
  provider: string | null;
  linkedNeedIds: string[];
};

export type DocumentIntelligenceNeed = {
  id: string;
  documentType: string;
  category: string;
  required: boolean;
  status: string;
  expectedDocumentCount: number | null;
  expectedMonths: number | null;
  timing: string | null;
  playbookKey: string | null;
  description: string | null;
};

export type DocumentIntelligenceRequest = {
  clientNeedId: string | null;
  draftType: string | null;
  requestedType: string | null;
};

export type DocumentIntelligenceSnapshot = {
  deal: DocumentIntelligenceDeal;
  documents: DocumentIntelligenceDocument[];
  needs: DocumentIntelligenceNeed[];
  requests: DocumentIntelligenceRequest[];
};

export type DocumentIntelligenceResult = {
  provider: DocumentIntelligenceProviderName;
  engine: "deterministic";
  usedBytes: false;
  usedOcr: false;
  executable: false;
  canMutateWorkflow: false;
  documents: DocumentIntelligenceDocumentResult[];
  completeness: DocumentSetCompleteness[];
  reviewQueue: DocumentReviewRecommendation[];
  disclaimer: typeof DOCUMENT_INTELLIGENCE_DISCLAIMER;
};

export type DocumentIntelligenceProvider = {
  name: DocumentIntelligenceProviderName;
  analyze(snapshot: DocumentIntelligenceSnapshot): Promise<DocumentIntelligenceResult>;
};

export function isDocumentIntelligenceProviderName(
  value: string,
): value is DocumentIntelligenceProviderName {
  return (DOCUMENT_INTELLIGENCE_PROVIDERS as readonly string[]).includes(value);
}
