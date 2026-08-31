import { applicationIntakeFromUnknown } from "@/lib/application/intake";
import type { CommunicationAttempt } from "@/lib/communications/types";
import type {
  ClientNeedRow,
  DealDetail,
  DocumentRow,
  TaskRow,
} from "@/lib/data/deals";
import type { DocumentIntelligenceSnapshot } from "@/lib/document-intelligence/types";

function expectedMonthsFromNeed(
  need: Pick<ClientNeedRow, "description" | "expectedDocumentCount">,
  playbookExpected?: number | null,
): number | null {
  const fromDescription = need.description?.match(/(\d+)\s*months?/i);
  if (fromDescription?.[1]) {
    return Number(fromDescription[1]);
  }
  if (playbookExpected && playbookExpected > 0) {
    return playbookExpected;
  }
  if (need.expectedDocumentCount && need.expectedDocumentCount > 0) {
    return need.expectedDocumentCount;
  }
  return null;
}

export function buildDocumentIntelligenceSnapshot(input: {
  deal: Pick<
    DealDetail,
    "id" | "loanType" | "propertyType" | "loanPurpose" | "applicationIntake"
  >;
  documents: Array<
    Pick<
      DocumentRow,
      | "id"
      | "fileName"
      | "mimeType"
      | "uploadedAt"
      | "documentType"
      | "status"
      | "storageProvider"
      | "linkedNeedIds"
    >
  >;
  needs: Array<
    Pick<
      ClientNeedRow,
      | "id"
      | "documentType"
      | "category"
      | "required"
      | "status"
      | "expectedDocumentCount"
      | "description"
    >
  >;
  tasks?: Array<
    Pick<TaskRow, "clientNeedId" | "timing" | "playbookKey">
  >;
  communications?: Array<
    Pick<CommunicationAttempt, "clientNeedId" | "draftType" | "subject">
  >;
}): DocumentIntelligenceSnapshot {
  const intake = applicationIntakeFromUnknown(input.deal.applicationIntake);
  const taskByNeed = new Map(
    (input.tasks ?? [])
      .filter((task) => task.clientNeedId)
      .map((task) => [task.clientNeedId as string, task]),
  );

  return {
    deal: {
      dealId: input.deal.id,
      loanType: input.deal.loanType,
      propertyType: input.deal.propertyType ?? intake?.propertyType ?? null,
      transaction: intake?.transaction ?? null,
      loanPurpose: input.deal.loanPurpose,
    },
    documents: input.documents.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      sizeBytes: null,
      uploadedAt: doc.uploadedAt,
      documentType: doc.documentType,
      status: doc.status,
      provider: doc.storageProvider,
      linkedNeedIds: [...doc.linkedNeedIds],
    })),
    needs: input.needs.map((need) => {
      const task = taskByNeed.get(need.id);
      return {
        id: need.id,
        documentType: need.documentType,
        category: need.category,
        required: need.required,
        status: need.status,
        expectedDocumentCount: need.expectedDocumentCount,
        expectedMonths: expectedMonthsFromNeed(need),
        timing: task?.timing ?? null,
        playbookKey: task?.playbookKey ?? null,
        description: need.description,
      };
    }),
    requests: (input.communications ?? []).map((item) => ({
      clientNeedId: item.clientNeedId,
      draftType: item.draftType,
      requestedType:
        input.needs.find((need) => need.id === item.clientNeedId)?.documentType ??
        item.subject,
    })),
  };
}
