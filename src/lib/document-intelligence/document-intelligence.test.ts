import { describe, expect, it } from "vitest";
import {
  analyzeDocumentIntelligence,
  extractPeriodFromFileName,
  needIntelligenceHints,
} from "./analyze";
import { getDocumentIntelligenceProviderName } from "./config";
import { getDocumentIntelligenceProvider } from "./factory";
import { buildDocumentIntelligenceSnapshot } from "./snapshot";
import {
  canApplyDocumentIntelligenceSuggestion,
  canViewDocumentIntelligence,
} from "./authorization";
import type { DocumentIntelligenceSnapshot } from "./types";

const sandboxEnv = {
  SANDBOX_MODE: "true",
  PRODUCTION_INTEGRATIONS_ENABLED: "false",
};

function snapshot(
  overrides: Partial<DocumentIntelligenceSnapshot> = {},
): DocumentIntelligenceSnapshot {
  return {
    deal: {
      dealId: "deal-1",
      loanType: "dscr",
      propertyType: "sfr",
      transaction: "purchase",
      loanPurpose: "investment",
    },
    documents: [
      {
        id: "doc-bank",
        fileName: "july-2026-chase-statement.pdf",
        mimeType: "application/pdf",
        sizeBytes: null,
        uploadedAt: "2026-08-21T00:00:00.000Z",
        documentType: null,
        status: "received",
        provider: "sandbox_mock",
        linkedNeedIds: ["need-bank"],
      },
    ],
    needs: [
      {
        id: "need-bank",
        documentType: "Bank Statements",
        category: "Liquidity",
        required: true,
        status: "received",
        expectedDocumentCount: 2,
        expectedMonths: 2,
        timing: "required_now",
        playbookKey: "request_bank_statements",
        description: "Most recent 2 months",
      },
    ],
    requests: [
      {
        clientNeedId: "need-bank",
        draftType: "initial",
        requestedType: "Bank Statements",
      },
    ],
    ...overrides,
  };
}

describe("document intelligence factory", () => {
  it("defaults to sandbox_mock_document_intelligence", () => {
    expect(getDocumentIntelligenceProviderName(sandboxEnv)).toBe(
      "sandbox_mock_document_intelligence",
    );
    expect(getDocumentIntelligenceProvider(sandboxEnv).name).toBe(
      "sandbox_mock_document_intelligence",
    );
  });

  it("refuses OCR and real providers", () => {
    expect(() =>
      getDocumentIntelligenceProviderName({
        ...sandboxEnv,
        DOCUMENT_INTELLIGENCE_PROVIDER: "ocr",
      }),
    ).toThrow(/disabled/i);
    expect(() =>
      getDocumentIntelligenceProvider({
        ...sandboxEnv,
        DOCUMENT_INTELLIGENCE_PROVIDER: "textract",
      }),
    ).toThrow(/disabled/i);
  });

  it("refuses intelligence when the sandbox guard is invalid", () => {
    expect(() =>
      getDocumentIntelligenceProviderName({
        SANDBOX_MODE: "false",
        PRODUCTION_INTEGRATIONS_ENABLED: "false",
      }),
    ).toThrow(/SANDBOX_MODE/);
  });
});

describe("metadata-only analysis", () => {
  it("returns deterministic results and never reads bytes", async () => {
    const provider = getDocumentIntelligenceProvider(sandboxEnv);
    const input = snapshot();
    const first = await provider.analyze(input);
    const second = await provider.analyze(input);
    expect(first).toEqual(second);
    expect(first.usedBytes).toBe(false);
    expect(first.usedOcr).toBe(false);
    expect(first.executable).toBe(false);
    expect(first.canMutateWorkflow).toBe(false);
    expect(first.reviewQueue.every((item) => item.executable === false)).toBe(true);
  });

  it("suggests a document type from the filename", () => {
    const result = analyzeDocumentIntelligence(snapshot());
    const doc = result.documents[0];
    expect(doc.classification.suggestedType).toBe("Bank Statements");
    expect(doc.classification.source).toBe("filename");
    expect(doc.classification.confidence).toBeGreaterThan(0.5);
    expect(doc.classification.reasons.join(" ")).toMatch(/filename/i);
  });

  it("flags a likely mismatch when the linked Need does not fit", () => {
    const result = analyzeDocumentIntelligence(
      snapshot({
        documents: [
          {
            id: "doc-id",
            fileName: "passport-alex.pdf",
            mimeType: "application/pdf",
            sizeBytes: null,
            uploadedAt: "2026-08-21T00:00:00.000Z",
            documentType: null,
            status: "needs_review",
            provider: "sandbox_mock",
            linkedNeedIds: ["need-bank"],
          },
        ],
      }),
    );
    expect(
      result.documents[0].needFit.some((item) => item.status === "mismatch"),
    ).toBe(true);
    expect(result.documents[0].recommendation.action).toBe("review_mismatch");
  });

  it("flags a likely duplicate from filename metadata", () => {
    const result = analyzeDocumentIntelligence(
      snapshot({
        documents: [
          {
            id: "doc-a",
            fileName: "july-2026-chase-statement.pdf",
            mimeType: "application/pdf",
            sizeBytes: null,
            uploadedAt: "2026-08-21T00:00:00.000Z",
            documentType: "Bank Statements",
            status: "received",
            provider: "sandbox_mock",
            linkedNeedIds: ["need-bank"],
          },
          {
            id: "doc-b",
            fileName: "july-2026-chase-statement.pdf",
            mimeType: "application/pdf",
            sizeBytes: null,
            uploadedAt: "2026-08-22T00:00:00.000Z",
            documentType: "Bank Statements",
            status: "received",
            provider: "sandbox_mock",
            linkedNeedIds: ["need-bank"],
          },
        ],
      }),
    );
    expect(result.documents[0].duplicates.some((flag) => flag.kind === "same_filename")).toBe(
      true,
    );
    expect(result.reviewQueue[0]?.action).toBe("review_duplicate");
  });

  it("reads a period from the filename when metadata is reliable", () => {
    expect(extractPeriodFromFileName("july-2026-chase-statement.pdf")).toBe("2026-07");
    expect(extractPeriodFromFileName("paystub-2026-08-01.pdf")).toBe("2026-08-01");
    const result = analyzeDocumentIntelligence(snapshot());
    expect(result.documents[0].period?.extractedPeriod).toBe("2026-07");
    expect(result.documents[0].period?.kind).toMatch(/gap|readable/);
  });

  it("reports set completeness without approving the Need", () => {
    const result = analyzeDocumentIntelligence(snapshot());
    const bank = result.completeness[0];
    expect(bank.countMet).toBe(false);
    expect(bank.processorDecisionRequired).toBe(true);
    expect(bank.summary).not.toMatch(/approved automatically|credit|fraud/i);
    expect(bank.linkedCount).toBe(1);
    expect(bank.expectedCount).toBe(2);
  });

  it("recommends linking an unlinked file that fits a requested Need", () => {
    const result = analyzeDocumentIntelligence(
      snapshot({
        documents: [
          {
            id: "doc-unlinked",
            fileName: "bank-statements-june-2026.pdf",
            mimeType: "application/pdf",
            sizeBytes: null,
            uploadedAt: "2026-08-21T00:00:00.000Z",
            documentType: null,
            status: "received",
            provider: "sandbox_mock",
            linkedNeedIds: [],
          },
        ],
      }),
    );
    expect(
      result.documents[0].needFit.some((item) => item.status === "candidate"),
    ).toBe(true);
    expect(result.documents[0].recommendation.action).toBe("link_need");
  });

  it("rejects snapshots that include file bytes or OCR payloads", () => {
    expect(() =>
      analyzeDocumentIntelligence(
        snapshot({
          documents: [
            {
              id: "doc-bad",
              fileName: "secret.pdf",
              mimeType: "application/pdf",
              sizeBytes: null,
              uploadedAt: "2026-08-21T00:00:00.000Z",
              documentType: null,
              status: "received",
              provider: "sandbox_mock",
              linkedNeedIds: [],
              ocr: "extracted text",
            } as never,
          ],
        }),
      ),
    ).toThrow(/bytes/i);
  });
});

describe("document intelligence snapshot", () => {
  it("keeps only metadata and omits emails, phones, and file contents", () => {
    const built = buildDocumentIntelligenceSnapshot({
      deal: {
        id: "deal-1",
        loanType: "dscr",
        propertyType: "sfr",
        loanPurpose: "investment",
        applicationIntake: {
          version: 1,
          source: "sandbox_application",
          transaction: "purchase",
          propertyType: "sfr",
        },
      },
      documents: [
        {
          id: "doc-1",
          fileName: "purchase-agreement.pdf",
          mimeType: "application/pdf",
          uploadedAt: "2026-08-21T00:00:00.000Z",
          documentType: "Purchase Agreement",
          status: "needs_review",
          storageProvider: "sandbox_mock",
          linkedNeedIds: ["need-1"],
        },
      ],
      needs: [
        {
          id: "need-1",
          documentType: "Purchase Agreement",
          category: "Legal",
          required: true,
          status: "requested",
          expectedDocumentCount: 1,
          description: null,
        },
      ],
      tasks: [
        {
          clientNeedId: "need-1",
          timing: "required_now",
          playbookKey: "request_purchase_agreement",
        },
      ],
      communications: [
        {
          clientNeedId: "need-1",
          draftType: "initial",
          subject: "Purchase Agreement needed",
        },
      ],
    });
    const serialized = JSON.stringify(built);
    expect(serialized).not.toMatch(/@|ssn|password|ocr|base64|filecontent/i);
    expect(built.deal.transaction).toBe("purchase");
    expect(built.documents[0]?.sizeBytes).toBeNull();
    expect(built.requests[0]?.requestedType).toBe("Purchase Agreement");
  });
});

describe("document intelligence evaluation scenarios", () => {
  function doc(
    id: string,
    fileName: string,
    linkedNeedIds: string[],
    status = "received",
  ) {
    return {
      id,
      fileName,
      mimeType: fileName.endsWith(".jpg") ? "image/jpeg" : "application/pdf",
      sizeBytes: null,
      uploadedAt: "2026-08-21T00:00:00.000Z",
      documentType: null,
      status,
      provider: "sandbox_mock",
      linkedNeedIds,
    };
  }

  it("A. matches a correctly linked bank statement from filename", () => {
    const result = analyzeDocumentIntelligence(
      snapshot({
        documents: [doc("doc-july", "july-2026-bank-statement.pdf", ["need-bank"])],
      }),
    );
    const item = result.documents[0];
    expect(item.classification.suggestedType).toMatch(/Bank Statement/i);
    expect(item.needFit.some((fit) => fit.status === "fit")).toBe(true);
    expect(item.classification.confidence).toBeGreaterThan(0.5);
    expect(item.recommendation.executable).toBe(false);
    expect(item.recommendation.action).not.toMatch(/approve|waive/i);
  });

  it("B. treats a second month as distinct and still requiring review", () => {
    const result = analyzeDocumentIntelligence(
      snapshot({
        documents: [
          doc("doc-july", "july-2026-bank-statement.pdf", ["need-bank"]),
          doc("doc-aug", "august-2026-bank-statement.pdf", ["need-bank"]),
        ],
      }),
    );
    const complete = result.completeness[0];
    expect(complete.linkedCount).toBe(2);
    expect(complete.expectedCount).toBe(2);
    expect(complete.countMet).toBe(true);
    expect(complete.processorDecisionRequired).toBe(true);
    const periods = result.documents.map((item) => item.period?.extractedPeriod);
    expect(periods).toEqual(expect.arrayContaining(["2026-07", "2026-08"]));
    expect(result.documents.every((item) => item.duplicates.length === 0)).toBe(
      true,
    );
  });

  it("C. flags a duplicate without deleting anything", () => {
    const result = analyzeDocumentIntelligence(
      snapshot({
        documents: [
          doc("doc-a", "july-2026-bank-statement.pdf", ["need-bank"]),
          doc("doc-b", "july-2026-bank-statement.pdf", ["need-bank"]),
        ],
      }),
    );
    expect(result.documents[0].duplicates.length).toBeGreaterThan(0);
    expect(result.usedBytes).toBe(false);
    expect(result.canMutateWorkflow).toBe(false);
  });

  it("D. flags an insurance binder linked to Government-issued ID", () => {
    const result = analyzeDocumentIntelligence(
      snapshot({
        needs: [
          {
            id: "need-id",
            documentType: "Government-issued ID",
            category: "Identity",
            required: true,
            status: "requested",
            expectedDocumentCount: 1,
            expectedMonths: null,
            timing: "required_now",
            playbookKey: "request_government_id",
            description: null,
          },
        ],
        documents: [doc("doc-ins", "insurance-binder.pdf", ["need-id"])],
        requests: [],
      }),
    );
    const item = result.documents[0];
    expect(item.classification.suggestedType).toBe("Insurance");
    expect(item.needFit.some((fit) => fit.status === "mismatch")).toBe(true);
    expect(item.recommendation.action).toBe("review_mismatch");
    expect(item.recommendation.label).toMatch(/mismatched/i);
    expect(result.canMutateWorkflow).toBe(false);
  });

  it("E. recommends reviewing a replacement while keeping the rejected file", () => {
    const result = analyzeDocumentIntelligence(
      snapshot({
        needs: [
          {
            id: "need-id",
            documentType: "Government-issued ID",
            category: "Identity",
            required: true,
            status: "rejected",
            expectedDocumentCount: 1,
            expectedMonths: null,
            timing: "required_now",
            playbookKey: "request_government_id",
            description: null,
          },
        ],
        documents: [
          {
            ...doc("doc-old", "blurry-id.pdf", ["need-id"], "rejected"),
            documentType: "Government-issued ID",
          },
          doc("doc-new", "passport-alex.pdf", [], "received"),
        ],
        requests: [
          {
            clientNeedId: "need-id",
            draftType: "replacement",
            requestedType: "Government-issued ID",
          },
        ],
      }),
    );
    const replacement = result.documents.find((item) => item.documentId === "doc-new");
    const rejected = result.documents.find((item) => item.documentId === "doc-old");
    expect(replacement?.recommendation.action).toBe("review_replacement");
    expect(replacement?.recommendation.label).toBe("Review replacement");
    expect(rejected?.documentId).toBe("doc-old");
    expect(needIntelligenceHints(result).some((hint) => hint.replacementCandidate)).toBe(
      true,
    );
  });

  it("F. leaves an unlinked photo unassociated", () => {
    const result = analyzeDocumentIntelligence(
      snapshot({
        documents: [doc("doc-photo", "misc-property-photo.jpg", [])],
      }),
    );
    const item = result.documents[0];
    expect(item.classification.suggestedType).toBeNull();
    expect(item.needFit.every((fit) => fit.status !== "fit")).toBe(true);
    expect(item.recommendation.action).toBe("review_unclassified");
    expect(item.recommendation.label).not.toMatch(/link to/i);
  });
});

describe("document intelligence authorization", () => {
  it("lets staff view suggestions and only processors apply them", () => {
    expect(canViewDocumentIntelligence("loan_officer")).toBe(true);
    expect(canApplyDocumentIntelligenceSuggestion("loan_officer")).toBe(false);
    expect(canApplyDocumentIntelligenceSuggestion("processor")).toBe(true);
  });
});
