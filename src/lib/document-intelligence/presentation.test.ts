import { describe, expect, it } from "vitest";
import {
  documentInspectorPrimaryAction,
  documentIntelligenceExplanation,
  documentIntelligenceHeadline,
  documentLooksConsistent,
  materialDocumentFlags,
  shouldShowConfidence,
} from "@/lib/document-intelligence/presentation";
import type { DocumentIntelligenceDocumentResult } from "@/lib/document-intelligence/types";

function result(
  overrides: Partial<DocumentIntelligenceDocumentResult> = {},
): DocumentIntelligenceDocumentResult {
  return {
    documentId: "doc-1",
    classification: {
      documentId: "doc-1",
      suggestedType: "Insurance Binder",
      confidence: 0.92,
      reasons: ["Filename mentions binder"],
      source: "filename",
    },
    needFit: [
      {
        documentId: "doc-1",
        needId: "need-1",
        needDocumentType: "Insurance Binder",
        status: "fit",
        linked: true,
        reasons: ["Linked type matches"],
      },
    ],
    duplicates: [],
    period: null,
    recommendation: {
      documentId: "doc-1",
      fileName: "binder.pdf",
      action: "processor_decision",
      label: "Processor decision still required",
      reasons: [],
      priority: 35,
      href: "/deals/1?tab=documents",
      executable: false,
    },
    ...overrides,
  };
}

describe("document intelligence presentation", () => {
  it("hides list flags when nothing material is wrong", () => {
    expect(materialDocumentFlags(result())).toEqual([]);
    expect(documentLooksConsistent(result())).toBe(true);
    expect(documentIntelligenceHeadline(result())).toBe("Likely match");
  });

  it("surfaces only material list flags", () => {
    const flagged = result({
      needFit: [
        {
          documentId: "doc-1",
          needId: "need-1",
          needDocumentType: "Government-issued ID",
          status: "mismatch",
          linked: true,
          reasons: ["Type does not match"],
        },
      ],
      recommendation: {
        ...result().recommendation,
        action: "review_mismatch",
        label: "Review mismatched link",
      },
    });
    expect(materialDocumentFlags(flagged)).toEqual(["Possible mismatch"]);
    expect(documentIntelligenceHeadline(flagged)).toBe("Possible mismatch");
  });

  it("keeps high confidence out of the default view", () => {
    expect(shouldShowConfidence(0.92)).toBe(false);
    expect(shouldShowConfidence(0.41)).toBe(true);
  });

  it("explains the intelligence state in plain language", () => {
    expect(documentIntelligenceExplanation(result())).toBe(
      "This looks like the requested Insurance Binder.",
    );
  });

  it("picks one inspector primary action from current state", () => {
    expect(
      documentInspectorPrimaryAction({
        documentType: "Government-issued ID",
        linkedNeedCount: 1,
      }),
    ).toBe("review");
    expect(
      documentInspectorPrimaryAction({
        documentType: null,
        linkedNeedCount: 0,
        suggestedType: "Insurance Binder",
      }),
    ).toBe("save");
    expect(
      documentInspectorPrimaryAction({
        documentType: "Insurance Binder",
        linkedNeedCount: 0,
      }),
    ).toBe("attach");
  });
});
