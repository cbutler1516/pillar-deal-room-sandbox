import {
  authorizeDocumentIntake,
  documentIntakeErrorMessage,
} from "@/lib/documents/authorization";
import { assertNoFilePayload } from "@/lib/documents/bytes-guard";
import {
  nextNeedStatusAfterDetach,
  nextNeedStatusAfterDocumentsAdded,
} from "@/lib/documents/need-progress";
import type { DocumentIntakeActor } from "@/lib/documents/types";
import { sanitizeActivityMetadata } from "@/lib/ops/workflow";
import type { UserRole } from "@/lib/auth/roles";

export const LINK_SOURCES = [
  "upload",
  "manual",
  "ai_suggested",
  "system",
] as const;

export type LinkSource = (typeof LINK_SOURCES)[number];

export type RelationDeal = {
  id: string;
  assignedProcessorId: string | null;
};

export type RelationNeed = {
  id: string;
  dealId: string;
  status: string;
  documentType: string;
  category: string;
  description: string | null;
  required: boolean;
  expectedDocumentCount: number | null;
  requireAllLinkedApproved: boolean;
  notes: string | null;
};

export type RelationDocument = {
  id: string;
  dealId: string;
  fileName: string;
  documentType: string | null;
  status: string;
};

export type RelationLink = {
  documentId: string;
  clientNeedId: string;
};

export type DocumentRelationStore = {
  getDeal(dealId: string): Promise<RelationDeal | null>;
  getNeed(needId: string): Promise<RelationNeed | null>;
  getDocument(documentId: string): Promise<RelationDocument | null>;
  listDocumentsForDeal(dealId: string): Promise<RelationDocument[]>;
  listLinksForNeed(needId: string): Promise<RelationLink[]>;
  listLinksForDocument(documentId: string): Promise<RelationLink[]>;
  insertLink(input: {
    documentId: string;
    clientNeedId: string;
    linkedBy: string;
    linkSource: LinkSource;
  }): Promise<"created" | "already_linked">;
  deleteLink(documentId: string, clientNeedId: string): Promise<boolean>;
  updateNeedStatus(needId: string, status: string, at: string): Promise<void>;
  insertNeed(row: {
    dealId: string;
    category: string;
    documentType: string;
    description: string | null;
    required: boolean;
    expectedDocumentCount: number | null;
    requireAllLinkedApproved: boolean;
    status: "missing";
  }): Promise<{ id: string }>;
};

export type RelationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type RelationDeps = {
  actor: DocumentIntakeActor;
  store: DocumentRelationStore;
  logActivity: (event: {
    dealId: string;
    actorId: string;
    eventType: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
};

function authorize(
  actor: DocumentIntakeActor,
  assignedProcessorId: string | null,
): RelationResult<true> {
  const decision = authorizeDocumentIntake({
    userId: actor.userId,
    role: actor.role,
    assignedProcessorId,
  });
  if (decision !== "ok") {
    return { ok: false, error: documentIntakeErrorMessage(decision) };
  }
  return { ok: true, data: true };
}

export function assertSameDealLink(
  documentDealId: string,
  needDealId: string,
): void {
  if (documentDealId !== needDealId) {
    throw new Error("A document may only link to a request on the same deal.");
  }
}

export function backfillDocumentNeedLinks(
  documents: { id: string; clientNeedId: string | null }[],
): { documentId: string; clientNeedId: string; linkSource: "system" }[] {
  return documents
    .filter((document) => document.clientNeedId)
    .map((document) => ({
      documentId: document.id,
      clientNeedId: document.clientNeedId as string,
      linkSource: "system" as const,
    }));
}

async function authorizeDeal(
  deps: RelationDeps,
  dealId: string,
): Promise<RelationResult<RelationDeal>> {
  const roleCheck = authorize(deps.actor, null);
  if (!roleCheck.ok) {
    return roleCheck;
  }
  const deal = await deps.store.getDeal(dealId);
  if (!deal) {
    return { ok: false, error: "Deal not found." };
  }
  const dealCheck = authorize(deps.actor, deal.assignedProcessorId);
  if (!dealCheck.ok) {
    return dealCheck;
  }
  return { ok: true, data: deal };
}

export async function attachDocumentsToClientNeed(
  deps: RelationDeps,
  input: { dealId: string; clientNeedId: string; documentIds: string[] },
): Promise<
  RelationResult<{ linked: string[]; alreadyLinked: string[]; needStatus: string }>
> {
  assertNoFilePayload(input);
  const authorized = await authorizeDeal(deps, input.dealId);
  if (!authorized.ok) {
    return authorized;
  }

  const uniqueIds = [...new Set(input.documentIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { ok: false, error: "Select at least one document to attach." };
  }

  const need = await deps.store.getNeed(input.clientNeedId);
  if (!need || need.dealId !== input.dealId) {
    return { ok: false, error: "Client need not found on this deal." };
  }

  const linked: string[] = [];
  const alreadyLinked: string[] = [];

  for (const documentId of uniqueIds) {
    const document = await deps.store.getDocument(documentId);
    if (!document || document.dealId !== input.dealId) {
      return { ok: false, error: "Document not found on this deal." };
    }
    try {
      assertSameDealLink(document.dealId, need.dealId);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Cross-deal link rejected.",
      };
    }

    const result = await deps.store.insertLink({
      documentId,
      clientNeedId: need.id,
      linkedBy: deps.actor.userId as string,
      linkSource: "manual",
    });
    if (result === "already_linked") {
      alreadyLinked.push(document.fileName);
      continue;
    }
    linked.push(document.fileName);
    await deps.logActivity({
      dealId: input.dealId,
      actorId: deps.actor.userId as string,
      eventType: "document_linked_to_client_need",
      metadata: {
        filename: document.fileName,
        client_need: need.documentType,
        external_file_id: "must-be-stripped",
        access_url: "https://sandbox.invalid/view/secret",
      },
    });
  }

  const links = await deps.store.listLinksForNeed(need.id);
  const docs = await Promise.all(
    links.map(async (link) => deps.store.getDocument(link.documentId)),
  );
  const nextStatus = nextNeedStatusAfterDocumentsAdded(
    need.status,
    docs.filter((doc): doc is RelationDocument => doc != null),
  );
  if (nextStatus) {
    await deps.store.updateNeedStatus(need.id, nextStatus, new Date().toISOString());
    await deps.logActivity({
      dealId: input.dealId,
      actorId: deps.actor.userId as string,
      eventType: "client_need_status_changed",
      metadata: { from: need.status, to: nextStatus },
    });
  }

  return {
    ok: true,
    data: {
      linked,
      alreadyLinked,
      needStatus: nextStatus ?? need.status,
    },
  };
}

export async function detachDocumentFromClientNeed(
  deps: RelationDeps,
  input: { dealId: string; documentId: string; clientNeedId: string },
): Promise<RelationResult<{ detached: true; documentKept: true; needStatus: string }>> {
  assertNoFilePayload(input);
  const authorized = await authorizeDeal(deps, input.dealId);
  if (!authorized.ok) {
    return authorized;
  }

  const [document, need] = await Promise.all([
    deps.store.getDocument(input.documentId),
    deps.store.getNeed(input.clientNeedId),
  ]);
  if (!document || document.dealId !== input.dealId) {
    return { ok: false, error: "Document not found on this deal." };
  }
  if (!need || need.dealId !== input.dealId) {
    return { ok: false, error: "Client need not found on this deal." };
  }

  const removed = await deps.store.deleteLink(document.id, need.id);
  if (!removed) {
    return { ok: false, error: "That document is not linked to this request." };
  }

  await deps.logActivity({
    dealId: input.dealId,
    actorId: deps.actor.userId as string,
    eventType: "document_unlinked_from_client_need",
    metadata: {
      filename: document.fileName,
      client_need: need.documentType,
      token: "must-be-stripped",
    },
  });

  const nextStatus = nextNeedStatusAfterDetach(need.status);
  if (nextStatus) {
    await deps.store.updateNeedStatus(need.id, nextStatus, new Date().toISOString());
    await deps.logActivity({
      dealId: input.dealId,
      actorId: deps.actor.userId as string,
      eventType: "client_need_status_changed",
      metadata: { from: need.status, to: nextStatus },
    });
  }

  return {
    ok: true,
    data: {
      detached: true,
      documentKept: true,
      needStatus: nextStatus ?? need.status,
    },
  };
}

export async function cloneClientNeed(
  deps: RelationDeps,
  input: { dealId: string; clientNeedId: string },
): Promise<RelationResult<{ id: string; status: "missing" }>> {
  const authorized = await authorizeDeal(deps, input.dealId);
  if (!authorized.ok) {
    return authorized;
  }

  const need = await deps.store.getNeed(input.clientNeedId);
  if (!need || need.dealId !== input.dealId) {
    return { ok: false, error: "Client need not found on this deal." };
  }

  const created = await deps.store.insertNeed({
    dealId: need.dealId,
    category: need.category,
    documentType: need.documentType,
    description: need.description,
    required: need.required,
    expectedDocumentCount: need.expectedDocumentCount,
    requireAllLinkedApproved: need.requireAllLinkedApproved,
    status: "missing",
  });

  await deps.logActivity({
    dealId: input.dealId,
    actorId: deps.actor.userId as string,
    eventType: "client_need_cloned",
    metadata: { client_need: need.documentType, status: "missing" },
  });

  return { ok: true, data: { id: created.id, status: "missing" } };
}

export function canAttachDocuments(
  assignedProcessorId: string | null,
  userId: string,
  role: UserRole,
): boolean {
  return (
    authorizeDocumentIntake({
      userId,
      role,
      assignedProcessorId,
    }) === "ok"
  );
}

export function activityMetadataForRelationTest(
  metadata: Record<string, unknown>,
): Record<string, string> {
  return sanitizeActivityMetadata(metadata);
}
