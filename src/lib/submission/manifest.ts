export type ManifestNeed = {
  id: string;
  documentType: string;
  status: string;
};

export type ManifestDocument = {
  id: string;
  fileName: string;
  documentType: string | null;
  status: string;
  uploadedAt: string;
  linkedNeedIds: string[];
};

export type SubmissionManifestItem = {
  id: string;
  fileName: string;
  documentType: string;
  needLabels: string[];
  status: string;
  uploadedAt: string;
  reviewStatus: string;
};

function needLabel(need: ManifestNeed | undefined, fallback: string): string {
  return need?.documentType?.trim() || fallback;
}

export function isSupersededDocument(
  doc: ManifestDocument,
  needs: ManifestNeed[],
  allDocs: ManifestDocument[],
): boolean {
  if (doc.status === "rejected") {
    return true;
  }
  const linked = needs.filter((need) => doc.linkedNeedIds.includes(need.id));
  if (linked.some((need) => need.status === "rejected")) {
    const laterApproved = allDocs.some(
      (other) =>
        other.id !== doc.id &&
        other.status === "approved" &&
        other.linkedNeedIds.some((id) => doc.linkedNeedIds.includes(id)) &&
        other.uploadedAt > doc.uploadedAt,
    );
    return laterApproved || doc.status !== "approved";
  }
  return false;
}

export function buildSubmissionManifest(input: {
  documents: ManifestDocument[];
  needs: ManifestNeed[];
}): SubmissionManifestItem[] {
  return input.documents
    .filter((doc) => doc.status === "approved")
    .filter((doc) => doc.linkedNeedIds.length > 0)
    .filter((doc) => !isSupersededDocument(doc, input.needs, input.documents))
    .map((doc) => {
      const linked = input.needs.filter((need) =>
        doc.linkedNeedIds.includes(need.id),
      );
      return {
        id: doc.id,
        fileName: doc.fileName,
        documentType: doc.documentType?.trim() || linked[0]?.documentType || "Document",
        needLabels: linked.map((need) => needLabel(need, "Need")),
        status: "Approved",
        uploadedAt: doc.uploadedAt,
        reviewStatus: "Reviewed",
      };
    });
}

export function isDocumentEligibleForManifest(
  doc: ManifestDocument,
  needs: ManifestNeed[],
  allDocs: ManifestDocument[],
): boolean {
  return buildSubmissionManifest({ documents: allDocs, needs }).some(
    (item) => item.id === doc.id,
  );
}
