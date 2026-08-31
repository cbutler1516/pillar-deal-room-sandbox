"use client";

import { useMemo, useState } from "react";
import { DocumentIntelligenceDetail } from "@/components/document-intelligence-detail";
import { TemporaryAccessControl } from "@/components/document-intake-panel";
import { StatusChip } from "@/components/status-chip";
import { FilterToggle } from "@/components/ui/controls";
import { buttonClass } from "@/components/ui/button";
import { DocumentStatusControl } from "@/components/workflow-controls";
import type { ClientNeedRow, DocumentRow } from "@/lib/data/deals";
import {
  documentHasMaterialIssue,
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
import { formatReceivedAt } from "@/lib/format";

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
  canIntake,
  intelligence = null,
}: {
  dealId: string;
  documents: DocumentRow[];
  needs: ClientNeedRow[];
  canMutate: boolean;
  canIntake: boolean;
  intelligence?: DocumentIntelligenceResult | null;
}) {
  const [filter, setFilter] = useState<DocumentInboxFilter>("needs_review");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <FilterToggle
            key={item.id}
            active={filter === item.id}
            onClick={() => setFilter(item.id)}
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
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
          <ul className="divide-y divide-line border-y border-line">
            {visible.map((doc) => {
              const active = doc.id === selected?.id;
              const intel = intelById.get(doc.id);
              const flags = materialDocumentFlags(intel);
              return (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(doc.id)}
                    className={`flex min-h-14 w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3.5 text-left ${
                      active ? "text-ink" : "hover:text-ink"
                    }`}
                    aria-current={active ? "true" : undefined}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{doc.fileName}</p>
                      <p className="mt-1 text-xs leading-5 text-ink-muted">
                        {[
                          doc.documentType ?? "Unclassified",
                          doc.linkedNeedIds.length === 0
                            ? "Unlinked"
                            : doc.linkedNeedIds.map(needLabel).join(" · "),
                        ].join(" · ")}
                      </p>
                      {flags.length > 0 ? (
                        <p className="mt-1 text-xs font-medium text-warning">
                          {flags.join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusChip status={doc.status} />
                      <p className="mt-1 text-xs text-ink-muted">
                        {formatReceivedAt(doc.uploadedAt)}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {selected ? (
            <DocumentDetailPanel
              key={selected.id}
              dealId={dealId}
              document={selected}
              needs={needs}
              canMutate={canMutate}
              canIntake={canIntake}
              needLabel={needLabel}
              intelligence={intelById.get(selected.id) ?? null}
            />
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
  canIntake,
  needLabel,
  intelligence,
}: {
  dealId: string;
  document: DocumentRow;
  needs: ClientNeedRow[];
  canMutate: boolean;
  canIntake: boolean;
  needLabel: (needId: string) => string;
  intelligence: DocumentIntelligenceDocumentResult | null;
}) {
  const [needId, setNeedId] = useState("");
  const [classification, setClassification] = useState(document.documentType ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const attachable = needs.filter(
    (need) => !document.linkedNeedIds.includes(need.id),
  );

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
    <aside className="space-y-5 xl:border-l xl:border-line xl:pl-8">
      <div>
        <p className="text-xs text-ink-muted">Selected document</p>
        <h4 className="mt-1 text-base font-semibold text-ink">{document.fileName}</h4>
        <p className="mt-1 text-sm leading-6 text-ink-muted">
          {document.documentType ?? "Unclassified"}
          {" · "}
          {document.linkedNeedIds.length === 0
            ? "Unlinked"
            : document.linkedNeedIds.map(needLabel).join(" · ")}
        </p>
        <div className="mt-2">
          <StatusChip status={document.status} />
        </div>
      </div>
      {intelligence ? <DocumentIntelligenceDetail result={intelligence} /> : null}
      {canIntake ? (
        <div>
          <p className="mb-1 text-xs text-ink-muted">Temporary secure access</p>
          <TemporaryAccessControl dealId={dealId} documentId={document.id} />
        </div>
      ) : null}
      {canMutate ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
              Attach to Need
            </p>
            {attachable.length === 0 ? (
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                This document is already linked to every Client Need on the deal.
              </p>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <select
                  value={needId}
                  onChange={(event) => setNeedId(event.target.value)}
                  className="min-h-10 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink"
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
                  className={buttonClass("accent", "sm")}
                >
                  Attach to Need
                </button>
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-ink-muted uppercase">
              Status update
            </p>
            <DocumentStatusControl documentId={document.id} status={document.status} />
          </div>
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
            <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
              Classify manually
            </p>
            <input
              name="documentType"
              value={classification}
              onChange={(event) => setClassification(event.target.value)}
              className="min-h-10 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink"
            />
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
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Save classification
            </button>
          </form>
        </div>
      ) : null}
      {message ? <p className="text-sm text-pillar-teal">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </aside>
  );
}
