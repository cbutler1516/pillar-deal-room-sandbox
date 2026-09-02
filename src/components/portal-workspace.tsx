"use client";

import { useState } from "react";
import {
  completePortalUploadSessionAction,
  createPortalUploadSessionAction,
} from "@/lib/application/portal-actions";
import type { PortalDeal } from "@/lib/application/portal-data";
import { SandboxBadge } from "@/components/sandbox-badge";
import { buttonClass } from "@/components/ui/button";
import { surfaceClass } from "@/components/ui/styles";
import { SANDBOX_MIME_TYPES } from "@/lib/documents/types";
import {
  PORTAL_NEED_GROUPS,
  PORTAL_PROGRESS_STEPS,
  portalNeedAction,
  portalNeedExplanation,
  portalNeedGroup,
  portalNeedStatusLabel,
  portalProgressStep,
  portalReceivedCopy,
  type PortalNeedLike,
} from "@/lib/portal/presentation";

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
  const current = portalProgressStep(deal.needs);

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

  async function upload(targetNeedId = needId) {
    setError(null);
    setMessage(null);
    setPending(true);
    const createData = new FormData();
    createData.set("portalToken", token);
    createData.set("clientNeedId", targetNeedId);
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
    setMessage("Sandbox upload recorded. File bytes were not sent to Pillar.");
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div className="border-b border-line pb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.14em] text-ink-muted uppercase">
              Pillar Private Lending
            </p>
            <h1 className="font-display mt-2 text-[1.75rem] font-semibold tracking-tight text-ink">
              {deal.borrowerName}
            </h1>
            {deal.entityName ? (
              <p className="mt-1 text-sm text-ink">{deal.entityName}</p>
            ) : null}
            <p className="mt-1 text-sm text-ink-muted">
              {[deal.loanType, deal.propertyLabel].filter(Boolean).join(" · ") ||
                "Business-purpose loan"}
            </p>
          </div>
          <SandboxBadge />
        </div>
        <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PORTAL_PROGRESS_STEPS.map((step) => {
            const active = step.key === current;
            return (
              <li
                key={step.key}
                className={`rounded-[8px] border px-3 py-2 text-xs ${
                  active
                    ? "border-mineral font-semibold text-mineral"
                    : "border-line text-ink-muted"
                }`}
              >
                {step.label}
              </li>
            );
          })}
        </ol>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-ink">What we need from you</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Upload only the items in Action needed. Our team reviews the rest.
        </p>
      </section>

      {deal.messages.length > 0 ? (
        <section className={`${surfaceClass("card")} space-y-3 px-5 py-4`}>
          <h2 className="text-sm font-semibold text-ink">Messages for you</h2>
          <ul className="space-y-3">
            {deal.messages.map((item) => (
              <li key={item.id} className="rounded-[12px] border border-line px-3 py-2">
                <p className="text-sm font-medium text-ink">{item.subject}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {PORTAL_NEED_GROUPS.map((group) => {
        const rows = deal.needs.filter((need) => portalNeedGroup(need) === group.key);
        if (rows.length === 0) {
          return null;
        }
        return (
          <section key={group.key} className="space-y-2">
            <h3 className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
              {group.label}
            </h3>
            <ul className="space-y-2">
              {rows.map((need) => (
                <NeedCard
                  key={need.id}
                  need={need}
                  pending={pending}
                  onUpload={() => {
                    setNeedId(need.id);
                    void upload(need.id);
                  }}
                />
              ))}
            </ul>
          </section>
        );
      })}

      <section className={`${surfaceClass("card")} space-y-3 px-5 py-4`}>
        <h2 className="text-sm font-semibold text-ink">Sandbox upload</h2>
        <p className="text-xs text-ink-muted">
          Demo only. Pillar stores filename, type, size, and a sandbox
          reference. Secure file storage can be connected later.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-ink-muted">
            Item
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
          <label className="text-xs font-medium text-ink-muted">
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
          Upload document
        </button>
        {message ? <p className="text-xs text-pillar-teal">{message}</p> : null}
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </section>
    </div>
  );
}

function NeedCard({
  need,
  pending,
  onUpload,
}: {
  need: PortalNeedLike;
  pending: boolean;
  onUpload: () => void;
}) {
  const action = portalNeedAction(need);
  const received = portalReceivedCopy(need);
  return (
    <li className={`${surfaceClass("card")} px-4 py-3.5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{need.documentType}</p>
          <p className="mt-1 text-xs font-medium text-ink">
            {portalNeedStatusLabel(need.status)}
            {received ? ` · ${received}` : ""}
          </p>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {portalNeedExplanation(need)}
          </p>
        </div>
        {action ? (
          <button
            type="button"
            className={buttonClass("accent", "sm")}
            disabled={pending}
            onClick={onUpload}
          >
            {action}
          </button>
        ) : null}
      </div>
    </li>
  );
}
