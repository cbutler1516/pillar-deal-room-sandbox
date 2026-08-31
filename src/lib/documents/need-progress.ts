export type LinkedDocumentStatus = {
  id: string;
  status: string;
};

export type NeedProgress = {
  receivedCount: number;
  approvedCount: number;
  needsReviewCount: number;
  rejectedCount: number;
  pendingCount: number;
  expectedCount: number | null;
  remainingCount: number | null;
  receivedLabel: string;
  reviewLabel: string | null;
  outstandingLabel: string;
};

const PENDING_DOCUMENT_STATUSES = new Set([
  "received",
  "classifying",
  "needs_review",
]);

export function isPendingDocumentStatus(status: string): boolean {
  return PENDING_DOCUMENT_STATUSES.has(status);
}

export function summarizeNeedDocuments(
  linked: LinkedDocumentStatus[],
  expectedDocumentCount: number | null = null,
): NeedProgress {
  const receivedCount = linked.length;
  const approvedCount = linked.filter((doc) => doc.status === "approved").length;
  const needsReviewCount = linked.filter(
    (doc) => doc.status === "needs_review" || doc.status === "classifying",
  ).length;
  const rejectedCount = linked.filter((doc) => doc.status === "rejected").length;
  const pendingCount = linked.filter((doc) =>
    isPendingDocumentStatus(doc.status),
  ).length;
  const remainingCount =
    expectedDocumentCount == null
      ? null
      : Math.max(0, expectedDocumentCount - receivedCount);

  const receivedLabel =
    expectedDocumentCount == null
      ? receivedCount === 0
        ? "No documents received"
        : `${receivedCount} document${receivedCount === 1 ? "" : "s"} received`
      : `${receivedCount} of ${expectedDocumentCount} received`;

  const reviewParts: string[] = [];
  if (approvedCount > 0) {
    reviewParts.push(`${approvedCount} approved`);
  }
  if (needsReviewCount > 0) {
    reviewParts.push(`${needsReviewCount} needs review`);
  }
  if (rejectedCount > 0) {
    reviewParts.push(`${rejectedCount} rejected`);
  }

  let outstandingLabel = "No linked documents";
  if (receivedCount > 0 && remainingCount != null && remainingCount > 0) {
    outstandingLabel = `${remainingCount} remaining`;
  } else if (pendingCount > 0) {
    outstandingLabel = "Review outstanding";
  } else if (receivedCount > 0 && rejectedCount > 0) {
    outstandingLabel = "Rejected evidence on file";
  } else if (receivedCount > 0) {
    outstandingLabel = "Evidence on file — processor decision required";
  }

  return {
    receivedCount,
    approvedCount,
    needsReviewCount,
    rejectedCount,
    pendingCount,
    expectedCount: expectedDocumentCount,
    remainingCount,
    receivedLabel,
    reviewLabel: reviewParts.length > 0 ? reviewParts.join(", ") : null,
    outstandingLabel,
  };
}

/**
 * Upload/attach must never auto-approve a Client Need.
 * missing/requested → received (or needs_review if any linked doc is in review).
 * approved / rejected / waived stay unchanged.
 */
export function nextNeedStatusAfterDocumentsAdded(
  currentStatus: string,
  linked: LinkedDocumentStatus[],
): string | null {
  if (
    currentStatus === "approved" ||
    currentStatus === "rejected" ||
    currentStatus === "waived"
  ) {
    return null;
  }

  const anyInReview = linked.some(
    (doc) => doc.status === "needs_review" || doc.status === "classifying",
  );

  if (currentStatus === "missing" || currentStatus === "requested") {
    return anyInReview ? "needs_review" : "received";
  }

  if (currentStatus === "received" && anyInReview) {
    return "needs_review";
  }

  return null;
}

/**
 * Detach never marks a need missing and never deletes the document.
 * Surface approved/received needs for processor review.
 */
export function nextNeedStatusAfterDetach(currentStatus: string): string | null {
  if (
    currentStatus === "rejected" ||
    currentStatus === "waived" ||
    currentStatus === "missing" ||
    currentStatus === "requested"
  ) {
    return null;
  }
  if (currentStatus === "needs_review") {
    return null;
  }
  return "needs_review";
}

export type DocumentWorkspaceFilter =
  | "all"
  | "needs_review"
  | "approved"
  | "unlinked"
  | "rejected";

export type DocumentInboxFilter =
  | "needs_review"
  | "issues"
  | "complete"
  | "all";

export function filterDocumentsForWorkspace<
  T extends { status: string; linkedNeedIds: string[] },
>(documents: T[], filter: DocumentWorkspaceFilter): T[] {
  switch (filter) {
    case "needs_review":
      return documents.filter(
        (doc) => doc.status === "needs_review" || doc.status === "classifying",
      );
    case "approved":
      return documents.filter((doc) => doc.status === "approved");
    case "unlinked":
      return documents.filter((doc) => doc.linkedNeedIds.length === 0);
    case "rejected":
      return documents.filter((doc) => doc.status === "rejected");
    default:
      return documents;
  }
}

export function filterDocumentsForInbox<T extends { id: string; status: string }>(
  documents: T[],
  filter: DocumentInboxFilter,
  issueIds: ReadonlySet<string> = new Set(),
): T[] {
  switch (filter) {
    case "needs_review":
      return documents.filter((doc) => isPendingDocumentStatus(doc.status));
    case "issues":
      return documents.filter(
        (doc) => doc.status === "rejected" || issueIds.has(doc.id),
      );
    case "complete":
      return documents.filter((doc) => doc.status === "approved");
    default:
      return documents;
  }
}
