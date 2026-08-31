"use client";

import { useMemo, useState } from "react";
import { DocumentIntelligenceDetail } from "@/components/document-intelligence-detail";
import { TemporaryAccessControl } from "@/components/document-intake-panel";
import { StatusChip } from "@/components/status-chip";
import { FilterToggle } from "@/components/ui/controls";
import { buttonClass } from "@/components/ui/button";
import { DocumentStatusControl } from "@/components/workflow-controls";
import type { ClientNeedRow, DocumentRow } from "@/lib/data/deals";
import type {
  DocumentIntelligenceDocumentResult,
  DocumentIntelligenceResult,
} from "@/lib/document-intelligence/types";
import { attachExistingAction } from "@/lib/documents/link-actions";
import { classifyDocumentAction } from "@/lib/workflow/actions";
import {
  filterDocumentsForWorkspace,
  type DocumentWorkspaceFilter,
} from "@/lib/documents/need-progress";
import { formatPercent, formatTimestamp } from "@/lib/format";

const FILTERS: { id: DocumentWorkspaceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "needs_review", label: "Needs Review" },
  { id: "approved", label: "Approved" },
  { id: "unlinked", label: "Unlinked" },
  { id: "rejected", label: "Rejected" },
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
  const [filter, setFilter] = useState<DocumentWorkspaceFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visible = useMemo(
    () => filterDocumentsForWorkspace(documents, filter),
    [documents, filter],
  );
  const selected =
    visible.find((doc) => doc.id === selectedId) ?? visible[0] ?? null;

  const needLabel = (needId: string) =>
    needs.find((need) => need.id === needId)?.documentType ?? "Client Need";

  return (
    <div className="space-y-4">
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
        <p className="text-sm text-ink-muted">
          No documents match this review filter.
        </p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,1fr)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] text-ink-muted">
                <tr>
                  <th className="px-0 py-2 font-medium">Filename</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Linked Client Needs</th>
                  <th className="px-3 py-2 font-medium">Uploaded</th>
                  <th className="px-3 py-2 font-medium">AI class</th>
                  <th className="px-3 py-2 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((doc) => {
                  const active = doc.id === selected?.id;
                  return (
                    <tr
                      key={doc.id}
                      className={`cursor-pointer border-t border-line ${
                        active ? "bg-surface-muted" : "hover:bg-surface-muted/70"
                      }`}
                      onClick={() => setSelectedId(doc.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(doc.id);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td className="px-3 py-2 font-medium text-ink">{doc.fileName}</td>
                      <td className="px-3 py-2 text-xs text-ink-muted">
                        {doc.documentType ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusChip status={doc.status} />
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-muted">
                        {doc.linkedNeedIds.length === 0 ? (
                          <span className="font-medium text-warning">Unlinked</span>
                        ) : (
                          doc.linkedNeedIds.map(needLabel).join(" · ")
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-muted">
                        {formatTimestamp(doc.uploadedAt)}
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-muted">
                        {doc.aiClassification ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-muted">
                        {formatPercent(doc.aiConfidence)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {selected ? (
            <DocumentDetailPanel
              key={selected.id}
              dealId={dealId}
              document={selected}
              needs={needs}
              canMutate={canMutate}
              canIntake={canIntake}
              needLabel={needLabel}
              intelligence={
                intelligence?.documents.find(
                  (item) => item.documentId === selected.id,
                ) ?? null
              }
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
                    <aside className="space-y-4 border-t border-line pt-4 xl:border-t-0 xl:border-l xl:pl-6 xl:pt-0">
      <div>
        <p className="text-[11px] text-ink-muted">Selected document</p>
        <h4 className="mt-1 text-sm font-semibold text-ink">{document.fileName}</h4>
      </div>
      <dl className="grid gap-3 text-xs">
        <Detail label="Document type" value={document.documentType} />
        <div>
          <dt className="text-ink-muted">Status</dt>
          <dd className="mt-1">
            <StatusChip status={document.status} />
          </dd>
        </div>
        <Detail label="Uploaded" value={formatTimestamp(document.uploadedAt)} />
        <div>
          <dt className="text-ink-muted">Linked needs</dt>
          <dd className="mt-1 text-ink">
            {document.linkedNeedIds.length === 0
              ? "Unlinked"
              : document.linkedNeedIds.map(needLabel).join(" · ")}
          </dd>
        </div>
        <Detail label="AI classification" value={document.aiClassification} />
        <Detail label="Confidence" value={formatPercent(document.aiConfidence)} />
      </dl>
      {intelligence ? <DocumentIntelligenceDetail result={intelligence} /> : null}
      {canIntake ? (
        <div>
          <p className="mb-1 text-[11px] text-ink-muted">Temporary secure access</p>
          <TemporaryAccessControl dealId={dealId} documentId={document.id} />
        </div>
      ) : null}
      {canMutate ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium tracking-wide text-ink-muted uppercase">
            Attach to Need
          </p>
          {attachable.length === 0 ? (
            <p className="text-xs text-ink-muted">
              This document is already linked to every Client Need on the deal.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <select
                value={needId}
                onChange={(event) => setNeedId(event.target.value)}
                className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink"
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
                className={buttonClass("primary", "sm")}
              >
                Attach to Need
              </button>
            </div>
          )}
          <div>
            <p className="mb-1 text-[11px] font-medium tracking-wide text-ink-muted uppercase">
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
            <p className="text-[11px] font-medium tracking-wide text-ink-muted uppercase">
              Classify manually
            </p>
            <input
              name="documentType"
              value={classification}
              onChange={(event) => setClassification(event.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink"
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
      {message ? <p className="text-xs text-pillar-teal">{message}</p> : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </aside>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="mt-1 text-ink">{value || "—"}</dd>
    </div>
  );
}
