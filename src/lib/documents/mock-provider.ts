import { randomUUID } from "node:crypto";
import { assertNoFilePayload, isValidSandboxFileName } from "@/lib/documents/bytes-guard";
import { isSandboxMimeType } from "@/lib/documents/types";
import {
  SANDBOX_MOCK_CAPABILITIES,
  SANDBOX_MOCK_PROVIDER,
  type CompleteUploadSessionInput,
  type CompleteUploadSessionResult,
  type CreateUploadSessionInput,
  type DocumentStorageProvider,
  type ProviderDocumentMetadata,
  type TemporaryAccess,
  type UploadSession,
} from "@/lib/documents/types";

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;
const DEFAULT_ACCESS_TTL_MS = 2 * 60 * 1000;

type PendingSession = {
  session: UploadSession;
  dealId: string;
  clientNeedId: string | null;
};

type StoredDocument = ProviderDocumentMetadata;

type AccessGrant = {
  url: string;
  expiresAt: string;
};

export type SandboxMockClock = () => Date;

/**
 * In-memory sandbox_mock provider.
 * Simulates upload sessions, completion, metadata, temporary view URLs,
 * deletion, and listing. Never accepts or persists file bytes.
 * URLs use https://sandbox.invalid and never resolve to real borrower files.
 */
export class SandboxMockDocumentProvider implements DocumentStorageProvider {
  readonly name = SANDBOX_MOCK_PROVIDER;
  readonly capabilities = SANDBOX_MOCK_CAPABILITIES;

  private readonly pending = new Map<string, PendingSession>();
  private readonly documents = new Map<string, StoredDocument>();
  private readonly accessGrants = new Map<string, AccessGrant>();

  constructor(
    private readonly now: SandboxMockClock = () => new Date(),
    private readonly sessionTtlMs = DEFAULT_SESSION_TTL_MS,
    private readonly accessTtlMs = DEFAULT_ACCESS_TTL_MS,
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

    const sessionId = `sess_${randomUUID()}`;
    const created = this.now();
    const session: UploadSession = {
      sessionId,
      provider: SANDBOX_MOCK_PROVIDER,
      uploadUrl: `https://sandbox.invalid/upload/${sessionId}`,
      expiresAt: new Date(created.getTime() + this.sessionTtlMs).toISOString(),
      fileName: input.fileName.trim(),
      mimeType: input.mimeType,
    };
    this.pending.set(sessionId, {
      session,
      dealId: input.dealId,
      clientNeedId: input.clientNeedId ?? null,
    });
    return session;
  }

  async simulateReceive(sessionId: string): Promise<{ received: true; fileName: string }> {
    const pending = this.pending.get(sessionId);
    if (!pending) {
      throw new Error("Upload session was not found.");
    }
    if (this.isExpired(pending.session.expiresAt)) {
      this.pending.delete(sessionId);
      throw new Error("Upload session has expired.");
    }
    return { received: true, fileName: pending.session.fileName };
  }

  async completeUploadSession(
    input: CompleteUploadSessionInput,
  ): Promise<CompleteUploadSessionResult> {
    assertNoFilePayload(input);
    const pending = this.pending.get(input.sessionId);
    if (!pending) {
      throw new Error("Upload session was not found.");
    }
    if (this.isExpired(pending.session.expiresAt)) {
      this.pending.delete(input.sessionId);
      throw new Error("Upload session has expired.");
    }

    this.pending.delete(input.sessionId);
    const createdAt = this.now().toISOString();
    const externalFileId = `sandbox-mock-${input.sessionId}`;
    const metadata: StoredDocument = {
      provider: SANDBOX_MOCK_PROVIDER,
      externalFileId,
      fileName: pending.session.fileName,
      mimeType: pending.session.mimeType,
      fileSize: pending.session.fileName.length,
      createdAt,
      expiresAt: null,
      dealId: pending.dealId,
      clientNeedId: pending.clientNeedId,
    };
    this.documents.set(externalFileId, metadata);

    return {
      externalFileId,
      provider: SANDBOX_MOCK_PROVIDER,
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      fileSize: metadata.fileSize,
      createdAt,
      dealId: pending.dealId,
      clientNeedId: pending.clientNeedId,
    };
  }

  async getDocumentMetadata(externalFileId: string): Promise<ProviderDocumentMetadata> {
    const document = this.documents.get(externalFileId);
    if (!document) {
      throw new Error("Document metadata was not found.");
    }
    return document;
  }

  async getTemporaryAccessUrl(externalFileId: string): Promise<TemporaryAccess> {
    if (!externalFileId.trim()) {
      throw new Error("Document metadata was not found.");
    }

    const issuedAt = this.now();
    const expiresAt = new Date(issuedAt.getTime() + this.accessTtlMs).toISOString();
    const url = `https://sandbox.invalid/view/${externalFileId}?exp=${encodeURIComponent(expiresAt)}`;
    this.accessGrants.set(url, { url, expiresAt });

    return {
      url,
      expiresAt,
      simulated: true,
      label: "Temporary access available — sandbox only",
    };
  }

  async deleteDocument(externalFileId: string): Promise<void> {
    if (!this.documents.has(externalFileId)) {
      throw new Error("Document metadata was not found.");
    }
    this.documents.delete(externalFileId);
    for (const [url, grant] of this.accessGrants) {
      if (url.includes(externalFileId)) {
        this.accessGrants.delete(grant.url);
      }
    }
  }

  async listDealDocuments(dealId: string): Promise<ProviderDocumentMetadata[]> {
    return [...this.documents.values()].filter((document) => document.dealId === dealId);
  }

  isAccessUrlExpired(url: string, at: Date = this.now()): boolean {
    const grant = this.accessGrants.get(url);
    if (!grant) {
      return true;
    }
    return this.isExpired(grant.expiresAt, at);
  }

  resolveTemporaryAccess(url: string, at: Date = this.now()): TemporaryAccess | null {
    const grant = this.accessGrants.get(url);
    if (!grant || this.isExpired(grant.expiresAt, at)) {
      return null;
    }
    return {
      url: grant.url,
      expiresAt: grant.expiresAt,
      simulated: true,
      label: "Temporary access available — sandbox only",
    };
  }

  private isExpired(expiresAt: string, at: Date = this.now()): boolean {
    return new Date(expiresAt).getTime() <= at.getTime();
  }
}

let sharedProvider: SandboxMockDocumentProvider | null = null;

export function getSandboxMockProvider(): SandboxMockDocumentProvider {
  if (!sharedProvider) {
    sharedProvider = new SandboxMockDocumentProvider();
  }
  return sharedProvider;
}

export function resetSandboxMockProviderForTests(): void {
  sharedProvider = new SandboxMockDocumentProvider();
}
