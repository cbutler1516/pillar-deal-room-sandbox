import {
  authorizeDocumentIntake,
  documentIntakeErrorMessage,
} from "@/lib/documents/authorization";
import { nextNeedStatusAfterDocumentsAdded } from "@/lib/documents/need-progress";
import { assertNoFilePayload, isValidSandboxFileName } from "@/lib/documents/bytes-guard";
import { assertDocumentProviderGuard } from "@/lib/documents/config";
import { getDocumentStorageProvider } from "@/lib/documents/factory";
import {
  isSandboxMimeType,
  toSafeUploadSession,
  type DocumentIntakeActor,
  type DocumentMetadataRecord,
  type DocumentStorageProvider,
  type SafeUploadSession,
  type TemporaryAccess,
} from "@/lib/documents/types";
import { sanitizeActivityMetadata } from "@/lib/ops/workflow";
import type { SandboxEnv } from "@/lib/sandbox";

/**
 * Server-side upload-session orchestration.
 *
 * Sequence:
 * 1. Authenticated user + deal access check
 * 2. Provider adapter creates an upload session (no file bytes)
 * 3. Browser receives only safe session data (fake URL in sandbox_mock)
 * 4. Browser uploads directly to the provider (simulated here)
 * 5. Completion writes documents metadata only
 * 6. Client Need may move to received
 * 7. Activity log gets a sanitized event (no tokens, secrets, or file ids)
 *
 * Service role is not used here. Document inserts use the caller-provided
 * store (user-scoped Supabase in production of this action).
 */
export type DealAccessRecord = {
  id: string;
  assignedProcessorId: string | null;
};

export type NeedAccessRecord = {
  id: string;
  dealId: string;
  status: string;
  documentType: string;
};

export type StoredDocumentRecord = {
  id: string;
  dealId: string;
  fileName: string;
  externalFileId: string | null;
  storageProvider: string | null;
};

export type DocumentIntakeStore = {
  getDeal(dealId: string): Promise<DealAccessRecord | null>;
  getNeed(needId: string): Promise<NeedAccessRecord | null>;
  insertDocument(row: {
    dealId: string;
    fileName: string;
    documentType: string | null;
    storageProvider: string;
    externalFileId: string;
    mimeType: string;
    status: "received";
    uploadedAt: string;
  }): Promise<{ id: string }>;
  linkDocument(input: {
    documentId: string;
    clientNeedId: string;
    linkedBy: string;
    linkSource: "upload";
  }): Promise<void>;
  listNeedDocuments(needId: string): Promise<{ id: string; status: string }[]>;
  updateNeedStatus(needId: string, status: string, at: string): Promise<void>;
  getDocument(documentId: string): Promise<StoredDocumentRecord | null>;
};

export type ActivitySink = (event: {
  dealId: string;
  actorId: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}) => Promise<void>;

export type SessionServiceDeps = {
  actor: DocumentIntakeActor;
  store: DocumentIntakeStore;
  logActivity: ActivitySink;
  provider?: DocumentStorageProvider;
  env?: SandboxEnv;
};

export type SessionServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function authorizeForDeal(
  deps: SessionServiceDeps,
  dealId: string,
): Promise<SessionServiceResult<DealAccessRecord>> {
  assertDocumentProviderGuard(deps.env);
  const decision = authorizeDocumentIntake({
    userId: deps.actor.userId,
    role: deps.actor.role,
    assignedProcessorId: null,
  });
  if (decision === "unauthenticated" || decision === "forbidden_role") {
    return { ok: false, error: documentIntakeErrorMessage(decision) };
  }

  const deal = await deps.store.getDeal(dealId);
  if (!deal) {
    return { ok: false, error: "Deal not found." };
  }

  const dealDecision = authorizeDocumentIntake({
    userId: deps.actor.userId,
    role: deps.actor.role,
    assignedProcessorId: deal.assignedProcessorId,
  });
  if (dealDecision !== "ok") {
    return { ok: false, error: documentIntakeErrorMessage(dealDecision) };
  }
  return { ok: true, data: deal };
}

function providerOf(deps: SessionServiceDeps): DocumentStorageProvider {
  return deps.provider ?? getDocumentStorageProvider(deps.env);
}

export async function createDocumentUploadSession(
  deps: SessionServiceDeps,
  input: {
    dealId: string;
    clientNeedId?: string;
    fileName: string;
    mimeType: string;
  },
): Promise<SessionServiceResult<SafeUploadSession>> {
  assertNoFilePayload(input);
  const authorized = await authorizeForDeal(deps, input.dealId);
  if (!authorized.ok) {
    return authorized;
  }

  if (!isValidSandboxFileName(input.fileName)) {
    return { ok: false, error: "Enter a valid test filename." };
  }
  if (!isSandboxMimeType(input.mimeType)) {
    return { ok: false, error: "Choose a supported sandbox MIME type." };
  }

  let needLabel = "unlinked";
  if (input.clientNeedId) {
    const need = await deps.store.getNeed(input.clientNeedId);
    if (!need || need.dealId !== input.dealId) {
      return { ok: false, error: "Client need not found on this deal." };
    }
    needLabel = need.documentType;
  }

  const session = await providerOf(deps).createUploadSession({
    dealId: input.dealId,
    clientNeedId: input.clientNeedId || null,
    fileName: input.fileName.trim(),
    mimeType: input.mimeType,
  });

  await deps.logActivity({
    dealId: input.dealId,
    actorId: deps.actor.userId as string,
    eventType: "document_upload_session_created",
    metadata: {
      filename: session.fileName,
      client_need: needLabel,
      simulated: "true",
      upload_url: session.uploadUrl,
      token: session.sessionId,
      external_file_id: "must-be-stripped",
    },
  });

  return { ok: true, data: toSafeUploadSession(session) };
}

export async function completeDocumentUploadSession(
  deps: SessionServiceDeps,
  input: { sessionId: string; dealId: string },
): Promise<
  SessionServiceResult<{
    document: DocumentMetadataRecord;
    needUpdated: boolean;
  }>
> {
  assertNoFilePayload(input);
  const authorized = await authorizeForDeal(deps, input.dealId);
  if (!authorized.ok) {
    return authorized;
  }
  if (!input.sessionId.trim()) {
    return { ok: false, error: "Upload session is required." };
  }

  const completed = await providerOf(deps).completeUploadSession({
    sessionId: input.sessionId,
  });
  if (completed.dealId !== input.dealId) {
    return { ok: false, error: "Upload session does not belong to this deal." };
  }

  let need: NeedAccessRecord | null = null;
  if (completed.clientNeedId) {
    need = await deps.store.getNeed(completed.clientNeedId);
    if (!need || need.dealId !== input.dealId) {
      return { ok: false, error: "Client need not found on this deal." };
    }
  }

  const uploadedAt = completed.createdAt;
  const inserted = await deps.store.insertDocument({
    dealId: input.dealId,
    fileName: completed.fileName,
    documentType: need?.documentType ?? completed.fileName,
    storageProvider: completed.provider,
    externalFileId: completed.externalFileId,
    mimeType: completed.mimeType,
    status: "received",
    uploadedAt,
  });

  let needUpdated = false;
  if (need) {
    await deps.store.linkDocument({
      documentId: inserted.id,
      clientNeedId: need.id,
      linkedBy: deps.actor.userId as string,
      linkSource: "upload",
    });
    const linked = await deps.store.listNeedDocuments(need.id);
    const nextStatus = nextNeedStatusAfterDocumentsAdded(need.status, linked);
    if (nextStatus) {
      await deps.store.updateNeedStatus(need.id, nextStatus, uploadedAt);
      needUpdated = true;
      await deps.logActivity({
        dealId: input.dealId,
        actorId: deps.actor.userId as string,
        eventType: "client_need_status_changed",
        metadata: { from: need.status, to: nextStatus },
      });
    }
  }

  await deps.logActivity({
    dealId: input.dealId,
    actorId: deps.actor.userId as string,
    eventType: "document_metadata_recorded",
    metadata: {
      filename: completed.fileName,
      status: "received",
      simulated: "true",
      linked: need ? "true" : "false",
      external_file_id: completed.externalFileId,
      storage_provider: completed.provider,
      access_url: "https://sandbox.invalid/view/secret",
      upload_token: "must-be-stripped",
    },
  });

  return {
    ok: true,
    data: {
      document: {
        id: inserted.id,
        dealId: input.dealId,
        clientNeedId: need?.id ?? null,
        fileName: completed.fileName,
        documentType: need?.documentType ?? completed.fileName,
        storageProvider: completed.provider,
        mimeType: completed.mimeType,
        status: "received",
        uploadedAt,
      },
      needUpdated,
    },
  };
}

export async function requestTemporaryDocumentAccess(
  deps: SessionServiceDeps,
  input: { documentId: string; dealId: string },
): Promise<SessionServiceResult<TemporaryAccess>> {
  assertNoFilePayload(input);
  const authorized = await authorizeForDeal(deps, input.dealId);
  if (!authorized.ok) {
    return authorized;
  }

  const document = await deps.store.getDocument(input.documentId);
  if (!document || document.dealId !== input.dealId || !document.externalFileId) {
    return { ok: false, error: "Document reference was not found." };
  }

  const access = await providerOf(deps).getTemporaryAccessUrl(document.externalFileId);

  await deps.logActivity({
    dealId: input.dealId,
    actorId: deps.actor.userId as string,
    eventType: "document_access_requested",
    metadata: {
      filename: document.fileName,
      simulated: "true",
      access_url: access.url,
      token: "must-be-stripped",
      external_file_id: document.externalFileId,
    },
  });

  return { ok: true, data: access };
}

export function activityMetadataForTest(
  metadata: Record<string, unknown>,
): Record<string, string> {
  return sanitizeActivityMetadata(metadata);
}
