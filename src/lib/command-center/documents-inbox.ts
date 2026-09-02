import {
  isDocumentReviewWork,
  type OperationalWorkItem,
} from "@/lib/ops/operational-work";
import { formatOperationalAge } from "@/lib/command-center/aging";

export type DocumentReviewInboxRow = {
  id: string;
  fileName: string;
  borrowerName: string;
  suggestedType: string;
  intelligenceFlag: string | null;
  ageLabel: string | null;
  href: string;
};

export function deriveDocumentReviewInbox(input: {
  items: OperationalWorkItem[];
  documents: {
    id: string;
    dealId: string;
    fileName: string | null;
    documentType: string | null;
    status: string;
  }[];
  limit?: number;
  now?: Date;
}): DocumentReviewInboxRow[] {
  const limit = input.limit ?? 5;
  const rows: DocumentReviewInboxRow[] = [];
  const seen = new Set<string>();

  for (const item of input.items) {
    if (!isDocumentReviewWork(item)) {
      continue;
    }
    const docId =
      item.sourceKind === "document" ? item.sourceId : findReviewDocId(item, input.documents);
    if (!docId || seen.has(docId)) {
      continue;
    }
    seen.add(docId);
    const doc = input.documents.find((row) => row.id === docId);
    rows.push({
      id: docId,
      fileName: doc?.fileName ?? item.title,
      borrowerName: item.borrowerName,
      suggestedType: doc?.documentType ?? item.title,
      intelligenceFlag: doc?.status === "classifying" ? "Classifying" : null,
      ageLabel: formatOperationalAge(doc ? null : item.dueAt, input.now),
      href: item.href,
    });
    if (rows.length >= limit) {
      break;
    }
  }

  return rows;
}

function findReviewDocId(
  item: OperationalWorkItem,
  documents: { id: string; dealId: string; documentType: string | null; status: string }[],
): string | null {
  const match = documents.find(
    (doc) =>
      doc.dealId === item.dealId &&
      (doc.documentType?.toLowerCase() === item.title.toLowerCase() ||
        doc.status === "needs_review" ||
        doc.status === "received"),
  );
  return match?.id ?? null;
}
