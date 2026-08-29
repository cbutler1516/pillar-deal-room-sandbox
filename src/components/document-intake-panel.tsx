"use client";

import { useState } from "react";
import {
  completeUploadSessionAction,
  createUploadSessionAction,
  requestTemporaryAccessAction,
} from "@/lib/documents/actions";
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
}: {
  dealId: string;
  needs: NeedOption[];
  defaultNeedId?: string;
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
    const response = await createUploadSessionAction(formData);
    setPending(false);
    if (response.error || !response.data) {
      setSession(null);
      setError(response.error ?? "Unable to create an upload session.");
      return;
    }
    setSession(response.data);
  }

  function simulateUpload() {
    setError(null);
    setSimulated(true);
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
    <div className="space-y-4 rounded-2xl border border-line bg-workspace px-5 py-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pillar-teal-soft text-pillar-teal"
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
            Sandbox simulation — documents are stored with the external provider
            in production, not Pillar.
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
          onClick={simulateUpload}
          className="rounded-lg border border-pillar-teal bg-surface px-3 py-1.5 text-xs font-medium text-pillar-teal hover:bg-pillar-teal-soft disabled:opacity-50"
        >
          Simulate secure upload
        </button>
        <button
          type="button"
          disabled={!session || !simulated || pending}
          onClick={() => void completeSession()}
          className="rounded-lg bg-pillar-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-pillar-teal/90 disabled:opacity-50"
        >
          Complete mock upload
        </button>
      </div>

      {session ? (
        <dl className="grid gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink-muted sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">Provider</dt>
            <dd className="font-medium text-ink">{session.provider}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Session expires</dt>
            <dd>{session.expiresAt}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-ink-muted">Simulated upload target</dt>
            <dd className="break-all">{session.uploadUrl}</dd>
          </div>
        </dl>
      ) : null}

      {simulated && !result ? (
        <p className="text-xs text-pillar-teal">
          Direct-to-provider upload simulated. No file bytes left this browser.
        </p>
      ) : null}

      {result ? (
        <div className="space-y-2 rounded-xl border border-line px-3 py-2">
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
        <div className="rounded-xl border border-dashed border-line px-3 py-2 text-xs text-ink-muted">
          <p className="font-medium text-ink">{access.label}</p>
          <p className="mt-1">Simulated URL (does not render a file):</p>
          <p className="mt-1 break-all">{access.url}</p>
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
        <p className="max-w-xs text-[11px] break-all text-ink-muted">
          {access.label}. Expires {access.expiresAt}
        </p>
      ) : null}
      {error ? <p className="text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}
