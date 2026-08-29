"use client";

import { useState } from "react";
import {
  completePortalUploadSessionAction,
  createPortalUploadSessionAction,
} from "@/lib/application/portal-actions";
import type { PortalDeal } from "@/lib/application/portal-data";
import { SandboxBadge } from "@/components/sandbox-badge";
import { StatusChip } from "@/components/status-chip";
import { buttonClass } from "@/components/ui/button";
import { SANDBOX_MIME_TYPES } from "@/lib/documents/types";
import { formatCurrency } from "@/lib/format";

function statusMessage(status: string): string {
  if (status === "rejected") {
    return "Replacement needed";
  }
  if (status === "needs_review") {
    return "Received — under review";
  }
  if (status === "received") {
    return "Received";
  }
  if (status === "approved") {
    return "Accepted for this requirement";
  }
  if (status === "waived") {
    return "Waived";
  }
  return "Requested";
}

export function PortalWorkspace({
  token,
  deal,
}: {
  token: string;
  deal: PortalDeal;
}) {
  const [needId, setNeedId] = useState(deal.needs[0]?.id ?? "");
  const [fileName, setFileName] = useState("sandbox-test-statement.pdf");
  const [mimeType, setMimeType] = useState<(typeof SANDBOX_MIME_TYPES)[number]>(
    "application/pdf",
  );
  const [fileSize, setFileSize] = useState(42);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const percent =
    deal.requiredCount === 0
      ? 0
      : Math.round((deal.completeCount / deal.requiredCount) * 100);

  function onPick(file: File | undefined) {
    if (!file) {
      return;
    }
    setFileName(file.name);
    setFileSize(file.size || 42);
    if ((SANDBOX_MIME_TYPES as readonly string[]).includes(file.type)) {
      setMimeType(file.type as (typeof SANDBOX_MIME_TYPES)[number]);
    }
  }

  async function upload() {
    setError(null);
    setMessage(null);
    setPending(true);
    const createData = new FormData();
    createData.set("portalToken", token);
    createData.set("clientNeedId", needId);
    createData.set("fileName", fileName);
    createData.set("mimeType", mimeType);
    createData.set("fileSize", String(fileSize));
    const created = await createPortalUploadSessionAction(createData);
    if (created.error || !created.data) {
      setPending(false);
      setError(created.error ?? "Unable to start the upload session.");
      return;
    }
    const completeData = new FormData();
    completeData.set("portalToken", token);
    completeData.set("sessionId", created.data.sessionId);
    const completed = await completePortalUploadSessionAction(completeData);
    setPending(false);
    if (completed.error || !completed.data) {
      setError(completed.error ?? "Unable to complete the upload.");
      return;
    }
    setMessage("Test document metadata recorded. File bytes were not sent to Pillar.");
  }

  const groups = [
    { key: "required_now", label: "Required now" },
    { key: "required_later", label: "Required later" },
    { key: "optional", label: "Optional" },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            Sandbox borrower portal
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-pillar-navy">
            {deal.dealReference}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {deal.loanType ?? "Business-purpose loan"} · {deal.propertyLabel || "Property pending"}
          </p>
        </div>
        <SandboxBadge />
      </div>

      <section className="rounded-[10px] border border-line bg-surface p-5">
        <p className="text-xs text-ink-muted">Completion</p>
        <p className="mt-1 text-2xl font-semibold text-ink">{percent}%</p>
        <p className="mt-1 text-sm text-ink-muted">
          {deal.completeCount} of {deal.requiredCount} required Client Needs accepted
          or waived. Requested amount {formatCurrency(deal.loanAmount)}.
        </p>
      </section>

      {groups.map((group) => {
        const rows = deal.needs.filter((need) => need.timing === group.key);
        if (rows.length === 0) {
          return null;
        }
        return (
          <section key={group.key} className="space-y-2">
            <h2 className="text-sm font-semibold text-ink">{group.label}</h2>
            <ul className="divide-y divide-line border-y border-line">
              {rows.map((need) => (
                <li key={need.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{need.documentType}</p>
                    <p className="text-xs text-ink-muted">{statusMessage(need.status)}</p>
                  </div>
                  <StatusChip status={need.status} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="space-y-3 rounded-[10px] border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Upload a test document</h2>
        <p className="text-xs text-ink-muted">
          Choose a local fictitious file for evaluation. Pillar stores filename,
          type, size, and a mock provider reference only.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-ink-muted">
            Client Need
            <select
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
              value={needId}
              onChange={(event) => setNeedId(event.target.value)}
            >
              {deal.needs.map((need) => (
                <option key={need.id} value={need.id}>
                  {need.documentType}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-muted">
            Local test file
            <input
              type="file"
              className="mt-1 block w-full text-xs"
              onChange={(event) => onPick(event.target.files?.[0])}
            />
          </label>
        </div>
        <p className="text-xs text-ink-muted">
          Using {fileName} · {mimeType} · {fileSize} bytes
        </p>
        <button
          type="button"
          className={buttonClass("primary")}
          disabled={pending || !needId}
          onClick={() => void upload()}
        >
          Upload test document
        </button>
        {message ? <p className="text-xs text-pillar-teal">{message}</p> : null}
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </section>
    </div>
  );
}
