"use client";

import { useMemo, useRef, useState } from "react";
import { DocumentIntelligenceDetail } from "@/components/document-intelligence-detail";
import { DocumentPreview } from "@/components/document-preview";
import { FilterToggle } from "@/components/ui/controls";
import { buttonClass } from "@/components/ui/button";
import { DocumentStatusControl } from "@/components/workflow-controls";
import type { ClientNeedRow, DocumentRow } from "@/lib/data/deals";
import {
  documentHasMaterialIssue,
  documentInspectorPrimaryAction,
  documentIntelligenceHeadline,
  materialDocumentFlags,
} from "@/lib/document-intelligence/presentation";
import type {
  DocumentIntelligenceDocumentResult,
  DocumentIntelligenceResult,
} from "@/lib/document-intelligence/types";
import { attachExistingAction } from "@/lib/documents/link-actions";
import { classifyDocumentAction } from "@/lib/workflow/actions";
import {
  filterDocumentsForInbox,
  type DocumentInboxFilter,
} from "@/lib/documents/need-progress";
import { formatReceivedAt, formatStatusLabel } from "@/lib/format";
import { inspectorStickyClass } from "@/lib/ui/layout-chrome";

const FILTERS: { id: DocumentInboxFilter; label: string }[] = [
  { id: "needs_review", label: "Needs review" },
  { id: "issues", label: "Issues" },
  { id: "complete", label: "Complete" },
  { id: "all", label: "All" },
];

export function DocumentsWorkspace({
  dealId,
  documents,
  needs,
  canMutate,
  intelligence = null,
}: {
  dealId: string;
  documents: DocumentRow[];
  needs: ClientNeedRow[];
  canMutate: boolean;
  intelligence?: DocumentIntelligenceResult | null;
}) {
  const [filter, setFilter] = useState<DocumentInboxFilter>("needs_review");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const intelById = useMemo(() => {
    const map = new Map<string, DocumentIntelligenceDocumentResult>();
    for (const item of intelligence?.documents ?? []) {
      map.set(item.documentId, item);
    }
    return map;
  }, [intelligence]);
  const issueIds = useMemo(() => {
    const ids = new Set<string>();
    for (const doc of documents) {
      if (documentHasMaterialIssue(intelById.get(doc.id))) {
        ids.add(doc.id);
      }
    }
    return ids;
  }, [documents, intelById]);
  const visible = useMemo(
    () => filterDocumentsForInbox(documents, filter, issueIds),
    [documents, filter, issueIds],
  );
  const selected =
    visible.find((doc) => doc.id === selectedId) ?? visible[0] ?? null;

  const needLabel = (needId: string) =>
    needs.find((need) => need.id === needId)?.documentType ?? "Client Need";

  function selectDocument(id: string, openMobile = true) {
    setSelectedId(id);
    if (openMobile) {
      setMobileDetail(true);
    }
  }

  function focusRow(id: string) {
    rowRefs.current.get(id)?.focus();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <FilterToggle
            key={item.id}
            active={filter === item.id}
            onClick={() => {
              setFilter(item.id);
              setMobileDetail(false);
            }}
          >
            {item.label}
          </FilterToggle>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="text-sm leading-6 text-ink-muted">
          {filter === "needs_review"
            ? "Nothing needs your attention."
            : filter === "complete"
              ? "All required documents are reviewed."
              : filter === "issues"
                ? "No document issues are flagged."
                : "No documents are on this file yet."}
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.95fr)] lg:items-start">
          <ul
            className={`space-y-1 ${mobileDetail ? "hidden lg:block" : ""}`}
            role="listbox"
            aria-label="Document inbox"
          >
            {visible.map((doc, index) => {
              const active = doc.id === selected?.id;
              const intel = intelById.get(doc.id);
              const flags = materialDocumentFlags(intel);
              const signal =
                flags[0] ??
                (intel ? documentIntelligenceHeadline(intel) : formatStatusLabel(doc.status));
              return (
                <li key={doc.id} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    ref={(node) => {
                      if (node) {
                        rowRefs.current.set(doc.id, node);
                      } else {
                        rowRefs.current.delete(doc.id);
                      }
                    }}
                    onClick={() => selectDocument(doc.id)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown" && visible[index + 1]) {
                        event.preventDefault();
                        selectDocument(visible[index + 1].id, false);
                        focusRow(visible[index + 1].id);
                      }
                      if (event.key === "ArrowUp" && visible[index - 1]) {
                        event.preventDefault();
                        selectDocument(visible[index - 1].id, false);
                        focusRow(visible[index - 1].id);
                      }
                    }}
                    className={`flex min-h-14 w-full items-start justify-between gap-3 rounded-[14px] border-l-2 px-3 py-2.5 text-left transition duration-200 motion-reduce:transition-none ${
                      active
                        ? "border-l-pillar-teal bg-pillar-teal-soft/80 shadow-[var(--shadow-card)]"
                        : "border-l-transparent hover:bg-surface-muted/80"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {doc.fileName}
                      </p>
                      <p className="mt-0.5 truncate text-xs leading-5 text-ink-muted">
                        {[
                          doc.documentType ?? "Unclassified",
                          doc.linkedNeedIds.length === 0
                            ? "Unlinked"
                            : doc.linkedNeedIds.map(needLabel).join(" · "),
                        ].join(" · ")}
                      </p>
                      <p
                        className={`mt-1 text-xs font-medium ${
                          flags.length > 0 ? "text-warning" : "text-ink-muted"
                        }`}
                      >
                        {signal}
                      </p>
                    </div>
                    <time className="shrink-0 pt-0.5 text-xs tabular-nums text-ink-muted">
                      {formatReceivedAt(doc.uploadedAt)}
                    </time>
                  </button>
                </li>
              );
            })}
          </ul>
          {selected ? (
            <div
              className={`${mobileDetail ? "" : "hidden lg:block"} inspector-enter ${inspectorStickyClass} rounded-[14px] border border-line bg-surface px-4 py-4 shadow-[var(--shadow-card)]`}
            >
              <button
                type="button"
                className={`${buttonClass("ghost", "sm")} mb-3 lg:hidden`}
                onClick={() => setMobileDetail(false)}
              >
                ← Inbox
              </button>
              <DocumentDetailPanel
                key={selected.id}
                dealId={dealId}
                document={selected}
                needs={needs}
                canMutate={canMutate}
                needLabel={needLabel}
                intelligence={intelById.get(selected.id) ?? null}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function DocumentDetailPanel({
  dealId,
  document,
  needs,
  canMutate,
  needLabel,
  intelligence,
}: {
  dealId: string;
  document: DocumentRow;
  needs: ClientNeedRow[];
  canMutate: boolean;
  needLabel: (needId: string) => string;
  intelligence: DocumentIntelligenceDocumentResult | null;
}) {
  const [needId, setNeedId] = useState("");
  const [classification, setClassification] = useState(document.documentType ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const attachable = needs.filter(
    (need) => !document.linkedNeedIds.includes(need.id),
  );
  const primary = documentInspectorPrimaryAction({
    documentType: document.documentType,
    linkedNeedCount: document.linkedNeedIds.length,
    suggestedType: intelligence?.classification.suggestedType ?? null,
  });

  async function attach() {
    setError(null);
    setMessage(null);
    const formData = new FormData();
    formData.set("dealId", dealId);
    formData.set("clientNeedId", needId);
    formData.append("documentIds", document.id);
    const result = await attachExistingAction(formData);
    if (result.error || !result.data) {
      setError(result.error ?? "Unable to attach this document.");
      return;
    }
    setNeedId("");
    setMessage("Linked to Client Need without copying the file.");
  }

  return (
    <aside className="space-y-4">
      <div>
        <h4 className="text-lg font-semibold tracking-tight break-all text-ink">
          {document.fileName}
        </h4>
        {intelligence ? (
          <div className="mt-2">
            <DocumentIntelligenceDetail result={intelligence} />
          </div>
        ) : (
          <p className="mt-1.5 text-sm leading-6 text-ink-muted">
            {document.documentType ?? "Unclassified"}
            {" · "}
            {document.linkedNeedIds.length === 0
              ? "Unlinked"
              : document.linkedNeedIds.map(needLabel).join(" · ")}
          </p>
        )}
      </div>

      <DocumentPreview
        key={document.id}
        dealId={dealId}
        documentId={document.id}
        fileName={document.fileName}
        mimeType={document.mimeType}
      />

      {canMutate ? (
        <div className="space-y-5">
          <form
            action={async (formData) => {
              formData.set("documentId", document.id);
              const result = await classifyDocumentAction(formData);
              if (result.error) {
                setError(result.error);
                return;
              }
              setMessage("Document type updated. This is not an underwriting decision.");
            }}
            className="space-y-2"
          >
            <label className="block text-xs font-medium text-ink-muted">
              Document type
              <input
                name="documentType"
                value={classification}
                onChange={(event) => setClassification(event.target.value)}
                className="mt-1 min-h-10 w-full rounded-[14px] border border-line bg-surface px-3 py-2 text-sm text-ink"
              />
            </label>
            {intelligence?.classification.suggestedType ? (
              <button
                type="button"
                className={buttonClass("ghost", "sm")}
                onClick={() =>
                  setClassification(intelligence.classification.suggestedType ?? "")
                }
              >
                Use suggested type
              </button>
            ) : null}
            {primary === "save" ? (
              <button type="submit" className={buttonClass("accent")}>
                Save classification
              </button>
            ) : (
              <button type="submit" className={buttonClass("secondary", "sm")}>
                Save classification
              </button>
            )}
          </form>

          <div>
            <p className="text-xs font-medium text-ink-muted">Linked Needs</p>
            <p className="mt-1 text-sm leading-6 text-ink">
              {document.linkedNeedIds.length === 0
                ? "Unlinked"
                : document.linkedNeedIds.map(needLabel).join(" · ")}
            </p>
            {attachable.length === 0 ? (
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                This document is already linked to every Client Need on the deal.
              </p>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <select
                  value={needId}
                  onChange={(event) => setNeedId(event.target.value)}
                  className="min-h-10 rounded-[14px] border border-line bg-surface px-3 py-2 text-sm text-ink"
                >
                  <option value="">Select a Client Need</option>
                  {attachable.map((need) => (
                    <option key={need.id} value={need.id}>
                      {need.documentType}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!needId}
                  onClick={() => void attach()}
                  className={buttonClass(primary === "attach" ? "accent" : "secondary", primary === "attach" ? "md" : "sm")}
                >
                  Attach to Need
                </button>
              </div>
            )}
          </div>

          <div ref={statusRef}>
            <p className="mb-2 text-xs font-medium text-ink-muted">Document status</p>
            {primary === "review" ? (
              <button
                type="button"
                className={`${buttonClass("accent")} mb-3`}
                onClick={() =>
                  statusRef.current
                    ?.querySelector<HTMLElement>("select, button")
                    ?.focus()
                }
              >
                Review document
              </button>
            ) : null}
            <DocumentStatusControl documentId={document.id} status={document.status} />
          </div>
        </div>
      ) : null}

      {message ? <p className="text-sm text-pillar-teal">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </aside>
  );
}
