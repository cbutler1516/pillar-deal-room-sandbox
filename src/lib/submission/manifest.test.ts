import { describe, expect, it } from "vitest";
import {
  buildSubmissionManifest,
  isDocumentEligibleForManifest,
} from "@/lib/submission/manifest";

const needs = [
  { id: "n-id", documentType: "Government-issued ID", status: "rejected" },
  { id: "n-entity", documentType: "Entity Documents", status: "approved" },
  { id: "n-psa", documentType: "Purchase Agreement", status: "approved" },
];

const docs = [
  {
    id: "d-rejected",
    fileName: "old-id.pdf",
    documentType: "Government-issued ID",
    status: "rejected",
    uploadedAt: "2026-08-01T00:00:00.000Z",
    linkedNeedIds: ["n-id"],
  },
  {
    id: "d-entity",
    fileName: "articles.pdf",
    documentType: "Entity Documents",
    status: "approved",
    uploadedAt: "2026-08-10T00:00:00.000Z",
    linkedNeedIds: ["n-entity"],
  },
  {
    id: "d-review",
    fileName: "bank.pdf",
    documentType: "Bank Statements",
    status: "needs_review",
    uploadedAt: "2026-08-11T00:00:00.000Z",
    linkedNeedIds: ["n-entity"],
  },
  {
    id: "d-unlinked",
    fileName: "appraisal.pdf",
    documentType: "Appraisal",
    status: "approved",
    uploadedAt: "2026-08-12T00:00:00.000Z",
    linkedNeedIds: [],
  },
  {
    id: "d-psa",
    fileName: "psa.pdf",
    documentType: "Purchase Agreement",
    status: "approved",
    uploadedAt: "2026-08-09T00:00:00.000Z",
    linkedNeedIds: ["n-psa"],
  },
];

describe("submission package manifest", () => {
  it("includes only approved, linked, non-superseded documents", () => {
    const manifest = buildSubmissionManifest({ documents: docs, needs });
    expect(manifest.map((item) => item.id)).toEqual(["d-entity", "d-psa"]);
    expect(manifest.every((item) => item.status === "Approved")).toBe(true);
  });

  it("excludes rejected, unreviewed, unlinked, and superseded files", () => {
    expect(isDocumentEligibleForManifest(docs[0]!, needs, docs)).toBe(false);
    expect(isDocumentEligibleForManifest(docs[2]!, needs, docs)).toBe(false);
    expect(isDocumentEligibleForManifest(docs[3]!, needs, docs)).toBe(false);
    expect(isDocumentEligibleForManifest(docs[1]!, needs, docs)).toBe(true);
  });
});
