"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { requestTemporaryAccessAction } from "@/lib/documents/actions";
import {
  PREVIEW_COPY,
  previewKindFromFile,
  resolvePreviewDisplay,
  shouldRequestPreviewAccess,
  type PreviewAccess,
  type PreviewDisplay,
} from "@/lib/documents/preview";

export function DocumentPreview({
  dealId,
  documentId,
  fileName,
  mimeType,
}: {
  dealId: string;
  documentId: string;
  fileName: string;
  mimeType: string | null;
}) {
  const kind = previewKindFromFile({ mimeType, fileName });
  const canPreview = shouldRequestPreviewAccess(kind);
  const [loading, setLoading] = useState(canPreview);
  const [failed, setFailed] = useState(false);
  const [access, setAccess] = useState<PreviewAccess | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!canPreview) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const formData = new FormData();
      formData.set("dealId", dealId);
      formData.set("documentId", documentId);
      try {
        const result = await requestTemporaryAccessAction(formData);
        if (cancelled) {
          return;
        }
        if (result.error || !result.data) {
          setFailed(true);
          setAccess(null);
          setLoading(false);
          return;
        }
        setAccess({
          url: result.data.url,
          expiresAt: result.data.expiresAt,
          simulated: result.data.simulated,
        });
        setLoading(false);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setAccess(null);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canPreview, dealId, documentId, retryTick]);

  const display = resolvePreviewDisplay({
    fileName,
    mimeType,
    loading,
    failed,
    access,
  });

  return (
    <section className="space-y-2" aria-label={`Preview of ${fileName}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-muted">
          <span className="mr-2 rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ink">
            {display.kindLabel}
          </span>
          Preview
        </p>
        <PreviewToolbar
          display={display}
          onRetry={() => {
            setLoading(true);
            setFailed(false);
            setAccess(null);
            setRetryTick((value) => value + 1);
          }}
        />
      </div>
      <PreviewCanvas
        display={display}
        onMediaError={() => {
          setFailed(true);
          setAccess(null);
        }}
      />
    </section>
  );
}

function PreviewToolbar({
  display,
  onRetry,
}: {
  display: PreviewDisplay;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {display.mode === "pdf" || display.mode === "image" ? (
        <a
          href={display.url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("ghost", "sm")}
        >
          {PREVIEW_COPY.openTab}
        </a>
      ) : null}
      {display.mode === "unavailable" ||
      display.mode === "pdf" ||
      display.mode === "image" ||
      display.mode === "sandbox" ? (
        <button type="button" className={buttonClass("ghost", "sm")} onClick={onRetry}>
          {display.mode === "unavailable" ? PREVIEW_COPY.retry : PREVIEW_COPY.refresh}
        </button>
      ) : null}
    </div>
  );
}

function PreviewCanvas({
  display,
  onMediaError,
}: {
  display: PreviewDisplay;
  onMediaError: () => void;
}) {
  const frame =
    "overflow-hidden rounded-[16px] border border-line bg-[linear-gradient(180deg,#c5ced9_0%,#d2dae4_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),inset_0_8px_18px_rgb(11_31_58/0.08)]";

  if (display.mode === "loading") {
    return (
      <div className={`${frame} flex h-52 items-center justify-center`}>
        <p className="text-sm text-ink-muted">Loading preview…</p>
      </div>
    );
  }

  if (display.mode === "unsupported") {
    return (
      <div className={`${frame} px-4 py-8 text-center`}>
        <p className="text-sm font-medium text-ink">{PREVIEW_COPY.unsupported}</p>
        <p className="mt-1 truncate text-xs text-ink-muted">{display.fileName}</p>
      </div>
    );
  }

  if (display.mode === "unavailable") {
    return (
      <div className={`${frame} px-4 py-8 text-center`}>
        <p className="text-sm font-medium text-ink">{PREVIEW_COPY.unavailable}</p>
      </div>
    );
  }

  if (display.mode === "sandbox") {
    return (
      <div className={`${frame} px-5 py-7 text-center`}>
        <p className="text-[11px] font-semibold tracking-[0.14em] text-pillar-navy">
          {display.kindLabel} PREVIEW
        </p>
        <p className="mt-2 break-all text-sm font-medium text-ink">{display.fileName}</p>
        <p className="mt-3 text-[10px] font-semibold tracking-[0.16em] text-pillar-teal">
          SANDBOX
        </p>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-ink-muted">
          {PREVIEW_COPY.sandbox}
        </p>
      </div>
    );
  }

  if (display.mode === "pdf") {
    return (
      <div className={`${frame} p-2`}>
        <iframe
          title={`Preview of ${display.fileName}`}
          src={display.url}
          onError={onMediaError}
          className="h-64 w-full rounded-[8px] border border-line bg-surface shadow-[var(--shadow-page)]"
        />
      </div>
    );
  }

  return (
    <div className={`${frame} flex min-h-40 items-center justify-center p-4`}>
      {/* Provider URLs are short-lived and unknown at build time. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={display.url}
        alt={display.fileName}
        onError={onMediaError}
        className="max-h-64 w-full rounded-[8px] bg-surface object-contain shadow-[var(--shadow-page)]"
      />
    </div>
  );
}
