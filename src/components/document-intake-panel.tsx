"use client";

import { useState } from "react";
import {
  completeUploadSessionAction,
  createUploadSessionAction,
  requestTemporaryAccessAction,
  simulateSandboxMockUploadAction,
} from "@/lib/documents/actions";
import {
  createFictitiousTestBlob,
  uploadBlobToProviderSession,
} from "@/lib/documents/direct-upload";
import { SANDBOX_MIME_TYPES } from "@/lib/documents/types";
import type { DocumentMetadataRecord, SafeUploadSession, TemporaryAccess } from "@/lib/documents/types";

type NeedOption = {
  id: string;
  documentType: string;
  status: string;
};

export function DocumentIntakePanel({
  dealId,
  needs,
  defaultNeedId,
  sandboxMock = false,
}: {
  dealId: string;
  needs: NeedOption[];
  defaultNeedId?: string;
  sandboxMock?: boolean;
}) {
  const [clientNeedId, setClientNeedId] = useState(defaultNeedId ?? needs[0]?.id ?? "");
  const [fileName, setFileName] = useState("sandbox-test-statement.pdf");
  const [mimeType, setMimeType] = useState<(typeof SANDBOX_MIME_TYPES)[number]>(
    "application/pdf",
  );
  const [session, setSession] = useState<SafeUploadSession | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [result, setResult] = useState<DocumentMetadataRecord | null>(null);
  const [access, setAccess] = useState<TemporaryAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function createSession() {
    setError(null);
    setAccess(null);
    setResult(null);
    setSimulated(false);
    setPending(true);
    const formData = new FormData();
    formData.set("dealId", dealId);
    formData.set("clientNeedId", clientNeedId);
    formData.set("fileName", fileName);
    formData.set("mimeType", mimeType);
    formData.set("fileSize", String(createFictitiousTestBlob(fileName, mimeType).size));
    const response = await createUploadSessionAction(formData);
    setPending(false);
    if (response.error || !response.data) {
      setSession(null);
      setError(response.error ?? "Unable to create an upload session.");
      return;
    }
    setSession(response.data);
  }

  async function sendTestDocument() {
    if (!session) {
      return;
    }
    setError(null);
    if (session.simulated) {
      setSimulated(true);
      return;
    }
    setPending(true);
    try {
      const blob = createFictitiousTestBlob(session.fileName, session.mimeType);
      await uploadBlobToProviderSession(session, blob);
      setSimulated(true);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Direct provider upload failed.",
      );
    } finally {
      setPending(false);
    }
  }

  async function completeSession() {
    if (!session) {
      return;
    }
    setError(null);
    setPending(true);
    const formData = new FormData();
    formData.set("dealId", dealId);
    formData.set("sessionId", session.sessionId);
    const response = await completeUploadSessionAction(formData);
    setPending(false);
    if (response.error || !response.data) {
      setError(response.error ?? "Unable to complete the mock upload.");
      return;
    }
    setResult(response.data.document);
  }

  async function simulateUpload() {
    setError(null);
    setAccess(null);
    setResult(null);
    setSimulated(false);
    setPending(true);
    const formData = new FormData();
    formData.set("dealId", dealId);
    formData.set("clientNeedId", clientNeedId);
    formData.set("fileName", fileName);
    formData.set("mimeType", mimeType);
    formData.set("fileSize", String(createFictitiousTestBlob(fileName, mimeType).size));
    const response = await simulateSandboxMockUploadAction(formData);
    setPending(false);
    if (response.error || !response.data) {
      setSession(null);
      setError(response.error ?? "Unable to simulate the sandbox upload.");
      return;
    }
    setSimulated(true);
    setResult(response.data.document);
  }

  async function requestAccess() {
    if (!result) {
      return;
    }
    setError(null);
    setPending(true);
    const formData = new FormData();
    formData.set("dealId", dealId);
    formData.set("documentId", result.id);
    const response = await requestTemporaryAccessAction(formData);
    setPending(false);
    if (response.error || !response.data) {
      setError(response.error ?? "Unable to issue temporary access.");
      return;
    }
    setAccess(response.data);
  }

  return (
    <div className="space-y-4 rounded-[12px] border border-line bg-stone px-5 py-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-pillar-teal-soft text-pillar-teal"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
            <path
              d="M10 3.5v8m0 0 3-3m-3 3-3-3M4.5 13.5v1a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div>
          <h3 className="text-sm font-semibold text-ink">Secure Document Upload</h3>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            Test documents upload directly to the configured storage provider.
            Pillar stores metadata and an external reference only.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-ink-muted">
            Client Need
            <select
              value={clientNeedId}
              onChange={(event) => setClientNeedId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
            >
              <option value="">Unlinked (no Client Need)</option>
              {needs.map((need) => (
                <option key={need.id} value={need.id}>
                  {need.documentType} ({need.status.replaceAll("_", " ")})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-muted">
            Fake test filename
            <input
              type="text"
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
            />
          </label>
          <label className="text-xs text-ink-muted">
            Local test file
            <input
              type="file"
              className="mt-1 block w-full text-xs"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }
                setFileName(file.name);
                if ((SANDBOX_MIME_TYPES as readonly string[]).includes(file.type)) {
                  setMimeType(file.type as (typeof SANDBOX_MIME_TYPES)[number]);
                }
              }}
            />
          </label>
          <label className="text-xs text-ink-muted">
            Fake MIME type
            <select
              value={mimeType}
              onChange={(event) =>
                setMimeType(event.target.value as (typeof SANDBOX_MIME_TYPES)[number])
              }
              className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
            >
              {SANDBOX_MIME_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        </div>

      {sandboxMock ? (
        <div className="rounded-[10px] border border-dashed border-pillar-teal/40 bg-pillar-teal-soft/40 px-3 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-pillar-teal uppercase">
            SANDBOX — Simulated Upload
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Runs the mock session, receive, complete, and metadata persist steps in
            one action. No file bytes are stored.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => void simulateUpload()}
            className="mt-2 rounded-lg bg-pillar-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-pillar-teal/90 disabled:opacity-50"
          >
            Simulate Upload
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void createSession()}
          className="rounded-lg bg-pillar-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-pillar-navy-soft disabled:opacity-50"
        >
          Create upload session
        </button>
        <button
          type="button"
          disabled={!session || pending}
          onClick={() => void sendTestDocument()}
          className="rounded-lg border border-pillar-teal bg-surface px-3 py-1.5 text-xs font-medium text-pillar-teal hover:bg-pillar-teal-soft disabled:opacity-50"
        >
          {session && !session.simulated
            ? "Upload test document"
            : "Simulate secure upload"}
        </button>
        <button
          type="button"
          disabled={!session || !simulated || pending}
          onClick={() => void completeSession()}
          className="rounded-lg bg-pillar-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-pillar-teal/90 disabled:opacity-50"
        >
          Complete upload
        </button>
      </div>

      {session ? (
        <dl className="grid gap-2 rounded-[10px] border border-line bg-surface px-3 py-2 text-xs text-ink-muted sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">Provider</dt>
            <dd className="font-medium text-ink">{session.provider}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Session expires</dt>
            <dd>{session.expiresAt}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-ink-muted">Upload session</dt>
            <dd>
              {session.simulated
                ? session.uploadUrl
                : "Provider upload session ready. The upload URL is not shown."}
            </dd>
          </div>
        </dl>
      ) : null}

      {simulated && !result ? (
        <p className="text-xs text-pillar-teal">
          {session?.simulated
            ? "Direct-to-provider upload simulated. No file bytes were sent to Pillar."
            : "Test document sent directly to the storage provider. No file bytes were sent to Pillar."}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-2 rounded-[10px] border border-line px-3 py-2">
          <p className="text-xs font-semibold text-ink">
            Document metadata recorded
          </p>
          <dl className="grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Filename</dt>
              <dd className="font-medium text-ink">{result.fileName}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Type</dt>
              <dd>{result.documentType}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">MIME</dt>
              <dd>{result.mimeType}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Provider</dt>
              <dd>{result.storageProvider}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Status</dt>
              <dd>{result.status}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Uploaded</dt>
              <dd>{result.uploadedAt}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-ink-muted">External reference</dt>
              <dd>Recorded with provider (not shown)</dd>
            </div>
          </dl>
          <button
            type="button"
            disabled={pending}
            onClick={() => void requestAccess()}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted"
          >
            Request temporary access
          </button>
        </div>
      ) : null}

      {access ? (
        <div className="rounded-[10px] border border-dashed border-line px-3 py-2 text-xs text-ink-muted">
          <p className="font-medium text-ink">{access.label}</p>
          <p className="mt-1">
            {access.simulated
              ? "Simulated URL (does not render a file):"
              : "Temporary access is available. Open it only from this authorized session."}
          </p>
          {access.simulated ? (
            <p className="mt-1 break-all">{access.url}</p>
          ) : (
            <a
              href={access.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-pillar-navy underline"
            >
              Open temporary view
            </a>
          )}
          <p className="mt-1">Expires {access.expiresAt}</p>
        </div>
      ) : null}

      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function TemporaryAccessControl({
  dealId,
  documentId,
}: {
  dealId: string;
  documentId: string;
}) {
  const [access, setAccess] = useState<TemporaryAccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestAccess() {
    setError(null);
    const formData = new FormData();
    formData.set("dealId", dealId);
    formData.set("documentId", documentId);
    const response = await requestTemporaryAccessAction(formData);
    if (response.error || !response.data) {
      setError(response.error ?? "Unable to issue temporary access.");
      return;
    }
    setAccess(response.data);
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void requestAccess()}
        className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-muted"
      >
        Temp Access
      </button>
      {access ? (
        <div className="max-w-xs text-[11px] text-ink-muted">
          <p>
            {access.label}. Expires {access.expiresAt}
          </p>
          {access.simulated ? null : (
            <a
              href={access.url}
              target="_blank"
              rel="noreferrer"
              className="text-pillar-navy underline"
            >
              Open temporary view
            </a>
          )}
        </div>
      ) : null}
      {error ? <p className="text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}
