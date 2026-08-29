/**
 * Provider-neutral document storage types.
 *
 * Storage boundary (hard):
 * - Pillar never permanently stores borrower file bytes.
 * - Do not use Supabase Storage, local/Vercel disk, database blobs,
 *   base64 payloads, HubSpot attachments, or browser-to-Pillar upload proxying.
 * - Production path: borrower browser → third-party provider → external reference
 *   → Pillar stores metadata/workflow only. File bytes should not transit Pillar
 *   servers when the provider supports direct upload.
 *
 * Security:
 * - No raw file contents in logs.
 * - No storage tokens, upload URLs, or provider secrets in activity_log.
 * - No long-lived public document URLs.
 * - No provider secret keys in the browser.
 * - Temporary access URLs are short-lived and issued only after server-side
 *   authorization (authenticated admin/processor with deal access).
 * - Secure deletion/retention is delegated to the provider where available.
 * - Processor permissions follow deal assignment (eligible deals only).
 */

export const SANDBOX_MOCK_PROVIDER = "sandbox_mock" as const;

export const DOCUMENT_STORAGE_PROVIDERS = [SANDBOX_MOCK_PROVIDER] as const;

export type DocumentStorageProviderName =
  (typeof DOCUMENT_STORAGE_PROVIDERS)[number];

export type ProviderCapabilities = {
  directBrowserUpload: boolean;
  temporaryAccessUrls: boolean;
  fileDeletion: boolean;
  webhookCompletion: boolean;
  folderDealOrganization: boolean;
  retentionControls: boolean;
  auditEvents: boolean;
  virusScanningStatus: boolean;
  versioning: boolean;
};

export const SANDBOX_MOCK_CAPABILITIES: ProviderCapabilities = {
  directBrowserUpload: true,
  temporaryAccessUrls: true,
  fileDeletion: true,
  webhookCompletion: false,
  folderDealOrganization: true,
  retentionControls: false,
  auditEvents: true,
  virusScanningStatus: false,
  versioning: false,
};

export const SANDBOX_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type SandboxMimeType = (typeof SANDBOX_MIME_TYPES)[number];

export type CreateUploadSessionInput = {
  dealId: string;
  clientNeedId?: string | null;
  fileName: string;
  mimeType: string;
};

export type UploadSession = {
  sessionId: string;
  provider: DocumentStorageProviderName;
  uploadUrl: string;
  expiresAt: string;
  fileName: string;
  mimeType: string;
};

export type SafeUploadSession = {
  sessionId: string;
  provider: DocumentStorageProviderName;
  uploadUrl: string;
  expiresAt: string;
  fileName: string;
  mimeType: string;
  simulated: true;
  message: string;
};

export type CompleteUploadSessionInput = {
  sessionId: string;
};

export type CompleteUploadSessionResult = {
  externalFileId: string;
  provider: DocumentStorageProviderName;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
  createdAt: string;
  dealId: string;
  clientNeedId: string | null;
};

export type ProviderDocumentMetadata = {
  provider: DocumentStorageProviderName;
  externalFileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
  createdAt: string;
  expiresAt: string | null;
  dealId: string;
  clientNeedId: string | null;
};

export type TemporaryAccess = {
  url: string;
  expiresAt: string;
  simulated: boolean;
  label: string;
};

export interface DocumentStorageProvider {
  readonly name: DocumentStorageProviderName;
  readonly capabilities: ProviderCapabilities;
  createUploadSession(input: CreateUploadSessionInput): Promise<UploadSession>;
  completeUploadSession(
    input: CompleteUploadSessionInput,
  ): Promise<CompleteUploadSessionResult>;
  getDocumentMetadata(externalFileId: string): Promise<ProviderDocumentMetadata>;
  getTemporaryAccessUrl(externalFileId: string): Promise<TemporaryAccess>;
  deleteDocument(externalFileId: string): Promise<void>;
  listDealDocuments(dealId: string): Promise<ProviderDocumentMetadata[]>;
}

export type DocumentIntakeActor = {
  userId: string | null;
  role: import("@/lib/auth/roles").UserRole | null;
};

export type DocumentMetadataRecord = {
  id: string;
  dealId: string;
  clientNeedId: string | null;
  fileName: string;
  documentType: string;
  storageProvider: DocumentStorageProviderName;
  mimeType: string;
  status: "received";
  uploadedAt: string;
};

export function isSandboxMimeType(value: string): value is SandboxMimeType {
  return (SANDBOX_MIME_TYPES as readonly string[]).includes(value);
}

export function toSafeUploadSession(session: UploadSession): SafeUploadSession {
  return {
    sessionId: session.sessionId,
    provider: session.provider,
    uploadUrl: session.uploadUrl,
    expiresAt: session.expiresAt,
    fileName: session.fileName,
    mimeType: session.mimeType,
    simulated: true,
    message: "Sandbox secure upload simulation — no files are stored",
  };
}
