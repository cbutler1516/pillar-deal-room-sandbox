import { describe, expect, it } from "vitest";
import { analyzeDocumentIntelligence } from "@/lib/document-intelligence/analyze";
import type { DocumentIntelligenceSnapshot } from "@/lib/document-intelligence/types";
import {
  DOCUMENT_INTELLIGENCE_PREVIEW_FORBIDDEN_KEYS,
  PREVIEW_COPY,
  previewKindFromFile,
  previewKindLabel,
  resolvePreviewDisplay,
  shouldRequestPreviewAccess,
} from "@/lib/documents/preview";

describe("document preview kinds", () => {
  it("classifies PDF and image types from mime or extension", () => {
    expect(previewKindFromFile({ mimeType: "application/pdf" })).toBe("pdf");
    expect(previewKindFromFile({ fileName: "binder.PDF" })).toBe("pdf");
    expect(previewKindFromFile({ mimeType: "image/jpeg" })).toBe("image");
    expect(previewKindFromFile({ mimeType: "image/png" })).toBe("image");
    expect(previewKindFromFile({ mimeType: "image/webp" })).toBe("image");
    expect(previewKindFromFile({ fileName: "id.jpg" })).toBe("image");
    expect(previewKindFromFile({ mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })).toBe(
      "unsupported",
    );
    expect(previewKindFromFile({ fileName: "notes.docx" })).toBe("unsupported");
  });

  it("does not request access for unsupported types", () => {
    expect(shouldRequestPreviewAccess("pdf")).toBe(true);
    expect(shouldRequestPreviewAccess("image")).toBe(true);
    expect(shouldRequestPreviewAccess("unsupported")).toBe(false);
  });
});

describe("document preview display", () => {
  it("shows a polished sandbox placeholder instead of inventing file contents", () => {
    const display = resolvePreviewDisplay({
      fileName: "july-2026-bank-statement.pdf",
      mimeType: "application/pdf",
      loading: false,
      failed: false,
      access: {
        url: "https://sandbox.invalid/view/secret",
        expiresAt: "2026-08-31T12:02:00.000Z",
        simulated: true,
      },
    });
    expect(display).toEqual({
      mode: "sandbox",
      fileName: "july-2026-bank-statement.pdf",
      kindLabel: "PDF",
      kind: "pdf",
    });
    expect(PREVIEW_COPY.sandbox).toMatch(/mock storage does not retain/i);
    expect(previewKindLabel("pdf")).toBe("PDF");
  });

  it("embeds real provider PDFs and images from a temporary URL only", () => {
    expect(
      resolvePreviewDisplay({
        fileName: "insurance-binder.pdf",
        mimeType: "application/pdf",
        loading: false,
        failed: false,
        access: {
          url: "https://files.example/tmp/abc",
          expiresAt: "2026-08-31T12:02:00.000Z",
          simulated: false,
        },
      }),
    ).toEqual({
      mode: "pdf",
      fileName: "insurance-binder.pdf",
      kindLabel: "PDF",
      url: "https://files.example/tmp/abc",
    });
    expect(
      resolvePreviewDisplay({
        fileName: "license.png",
        mimeType: "image/png",
        loading: false,
        failed: false,
        access: {
          url: "https://files.example/tmp/img",
          expiresAt: "2026-08-31T12:02:00.000Z",
          simulated: false,
        },
      }).mode,
    ).toBe("image");
  });

  it("uses a clean unsupported and failure fallback", () => {
    expect(
      resolvePreviewDisplay({
        fileName: "entity-docs.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        loading: false,
        failed: false,
        access: null,
      }).mode,
    ).toBe("unsupported");
    expect(
      resolvePreviewDisplay({
        fileName: "id.jpg",
        mimeType: "image/jpeg",
        loading: false,
        failed: true,
        access: null,
      }),
    ).toMatchObject({ mode: "unavailable", canRetry: true });
  });
});

describe("document intelligence preview firewall", () => {
  const base: DocumentIntelligenceSnapshot = {
    deal: {
      dealId: "deal-1",
      loanType: "dscr",
      propertyType: "sfr",
      transaction: "purchase",
      loanPurpose: "investment",
    },
    documents: [
      {
        id: "doc-1",
        fileName: "july-2026-bank-statement.pdf",
        mimeType: "application/pdf",
        sizeBytes: null,
        uploadedAt: "2026-08-21T00:00:00.000Z",
        documentType: null,
        status: "received",
        provider: "sandbox_mock",
        linkedNeedIds: [],
      },
    ],
    needs: [],
    requests: [],
  };

  it("refuses preview URLs, tokens, and file bytes as intelligence input", () => {
    for (const key of DOCUMENT_INTELLIGENCE_PREVIEW_FORBIDDEN_KEYS) {
      expect(() =>
        analyzeDocumentIntelligence({
          ...base,
          documents: [{ ...base.documents[0], [key]: "blocked" }],
        }),
      ).toThrow(/not accepted/i);
    }
  });

  it("keeps metadata-only analysis after preview is added", () => {
    const result = analyzeDocumentIntelligence(base);
    expect(result.usedBytes).toBe(false);
    expect(result.usedOcr).toBe(false);
    expect(result.documents[0]).not.toHaveProperty("previewUrl");
    expect(result.documents[0]).not.toHaveProperty("url");
  });
});
