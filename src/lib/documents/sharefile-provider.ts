import "server-only";

import { randomUUID } from "node:crypto";
import { assertNoFilePayload, isValidSandboxFileName } from "@/lib/documents/bytes-guard";
import { createShareFileApiClient, type ShareFileApiClient } from "@/lib/documents/sharefile/client";
import {
  assertShareFileSandboxGuard,
  getShareFileConfig,
} from "@/lib/documents/sharefile/config";
import {
  SHAREFILE_CAPABILITIES,
  SHAREFILE_PROVIDER,
  isSandboxMimeType,
  type CompleteUploadSessionInput,
  type CompleteUploadSessionResult,
  type CreateUploadSessionInput,
  type DocumentStorageProvider,
  type ProviderDocumentMetadata,
  type TemporaryAccess,
  type UploadSession,
} from "@/lib/documents/types";
import type { SandboxEnv } from "@/lib/sandbox";

const SESSION_TTL_MS = 15 * 60 * 1000;
const ACCESS_TTL_MS = 2 * 60 * 1000;
const CLIENT_NEEDS_FOLDER = "Client Needs";
const MISCELLANEOUS_FOLDER = "Miscellaneous";

type PendingSession = {
  session: UploadSession;
  dealId: string;
  dealReference: string;
  clientNeedId: string | null;
  folderId: string;
};

function isValidDealReference(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/.test(value.trim());
}

export class ShareFileDocumentProvider implements DocumentStorageProvider {
  readonly name = SHAREFILE_PROVIDER;
  readonly capabilities = SHAREFILE_CAPABILITIES;

  private readonly pending = new Map<string, PendingSession>();
  private readonly folderCache = new Map<string, string>();

  constructor(
    private readonly client: ShareFileApiClient,
    private readonly rootFolderId: string,
  ) {}

  async createUploadSession(input: CreateUploadSessionInput): Promise<UploadSession> {
    assertNoFilePayload(input);
    if (!isValidSandboxFileName(input.fileName)) {
      throw new Error("A valid test filename is required.");
    }
    if (!isSandboxMimeType(input.mimeType)) {
      throw new Error("Unsupported sandbox MIME type.");
    }
    if (!input.dealId) {
      throw new Error("Deal is required.");
    }
    const dealReference = input.dealReference?.trim() ?? "";
    if (!isValidDealReference(dealReference)) {
      throw new Error("A valid deal reference is required.");
    }
    const fileSize = input.fileSize ?? 0;
    if (!Number.isFinite(fileSize) || fileSize < 1) {
      throw new Error("A test file size is required.");
    }

    const folderId = await this.resolveDestinationFolder(
      dealReference,
      Boolean(input.clientNeedId),
    );
    const specification = await this.client.createUploadSpecification({
      folderId,
      fileName: input.fileName.trim(),
      fileSize,
    });

    const sessionId = `sess_${randomUUID()}`;
    const session: UploadSession = {
      sessionId,
      provider: SHAREFILE_PROVIDER,
      uploadUrl: specification.chunkUri,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      fileName: input.fileName.trim(),
      mimeType: input.mimeType,
      uploadMethod: "POST",
      rawBody: true,
    };
    this.pending.set(sessionId, {
      session,
      dealId: input.dealId,
      dealReference,
      clientNeedId: input.clientNeedId ?? null,
      folderId,
    });
    return session;
  }

  async completeUploadSession(
    input: CompleteUploadSessionInput,
  ): Promise<CompleteUploadSessionResult> {
    assertNoFilePayload(input);
    const pending = this.pending.get(input.sessionId);
    if (!pending) {
      throw new Error("Upload session was not found.");
    }
    if (new Date(pending.session.expiresAt).getTime() <= Date.now()) {
      this.pending.delete(input.sessionId);
      throw new Error("Upload session has expired.");
    }

    const item = await this.client.findChildByName(
      pending.folderId,
      pending.session.fileName,
    );
    if (!item) {
      throw new Error("ShareFile has not confirmed the uploaded file.");
    }

    this.pending.delete(input.sessionId);
    return {
      externalFileId: item.id,
      provider: SHAREFILE_PROVIDER,
      fileName: item.fileName ?? pending.session.fileName,
      mimeType: pending.session.mimeType,
      fileSize: item.fileSize ?? null,
      createdAt: item.createdAt ?? new Date().toISOString(),
      dealId: pending.dealId,
      clientNeedId: pending.clientNeedId,
    };
  }

  async getDocumentMetadata(externalFileId: string): Promise<ProviderDocumentMetadata> {
    const item = await this.client.getItem(externalFileId);
    return {
      provider: SHAREFILE_PROVIDER,
      externalFileId: item.id,
      fileName: item.fileName ?? item.name,
      mimeType: "application/octet-stream",
      fileSize: item.fileSize ?? null,
      createdAt: item.createdAt ?? new Date().toISOString(),
      expiresAt: null,
      dealId: "",
      clientNeedId: null,
    };
  }

  async getTemporaryAccessUrl(externalFileId: string): Promise<TemporaryAccess> {
    if (!externalFileId.trim()) {
      throw new Error("Document metadata was not found.");
    }
    const specification = await this.client.getDownloadSpecification(externalFileId);
    return {
      url: specification.downloadUrl,
      expiresAt: new Date(Date.now() + ACCESS_TTL_MS).toISOString(),
      simulated: false,
      label: "Temporary provider access issued",
    };
  }

  async deleteDocument(externalFileId: string): Promise<void> {
    await this.client.deleteItem(externalFileId);
  }

  async listDealDocuments(dealId: string): Promise<ProviderDocumentMetadata[]> {
    void dealId;
    return [];
  }

  private async resolveDestinationFolder(
    dealReference: string,
    forClientNeed: boolean,
  ): Promise<string> {
    const dealFolderId = await this.getOrCreateNamedFolder(
      this.rootFolderId,
      dealReference,
    );
    return this.getOrCreateNamedFolder(
      dealFolderId,
      forClientNeed ? CLIENT_NEEDS_FOLDER : MISCELLANEOUS_FOLDER,
    );
  }

  private async getOrCreateNamedFolder(
    parentId: string,
    name: string,
  ): Promise<string> {
    const cacheKey = `${parentId}:${name}`;
    const cached = this.folderCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const folder = await this.client.createFolder(parentId, name);
    this.folderCache.set(cacheKey, folder.id);
    return folder.id;
  }
}

export function createShareFileDocumentProvider(
  env: SandboxEnv = process.env,
  client?: ShareFileApiClient,
): ShareFileDocumentProvider {
  assertShareFileSandboxGuard(env);
  const config = getShareFileConfig(env);
  return new ShareFileDocumentProvider(
    client ?? createShareFileApiClient(env),
    config.rootFolderId,
  );
}

let shared: ShareFileDocumentProvider | null = null;

export function getShareFileProvider(
  env: SandboxEnv = process.env,
): ShareFileDocumentProvider {
  if (!shared) {
    shared = createShareFileDocumentProvider(env);
  }
  return shared;
}

export function resetShareFileProviderForTests(): void {
  shared = null;
}
