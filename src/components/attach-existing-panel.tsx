"use client";

import { useMemo, useState } from "react";
import { attachExistingAction } from "@/lib/documents/link-actions";
import type { DocumentRow } from "@/lib/data/deals";

export function AttachExistingPanel({
  dealId,
  clientNeedId,
  documents,
}: {
  dealId: string;
  clientNeedId: string;
  documents: DocumentRow[];
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const types = useMemo(
    () =>
      [...new Set(documents.map((doc) => doc.documentType).filter(Boolean))] as string[],
    [documents],
  );

  const visible = documents.filter((doc) => {
    const alreadyLinked = doc.linkedNeedIds.includes(clientNeedId);
    const matchesQuery = doc.fileName.toLowerCase().includes(query.toLowerCase());
    const matchesType = typeFilter === "all" || doc.documentType === typeFilter;
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return !alreadyLinked && matchesQuery && matchesType && matchesStatus;
  });

  async function attach() {
    setError(null);
    setMessage(null);
    const formData = new FormData();
    formData.set("dealId", dealId);
    formData.set("clientNeedId", clientNeedId);
    for (const id of selected) {
      formData.append("documentIds", id);
    }
    const result = await attachExistingAction(formData);
    if (result.error || !result.data) {
      setError(result.error ?? "Unable to attach documents.");
      return;
    }
    setSelected([]);
    const linked = result.data.linked.length;
    const skipped = result.data.alreadyLinked.length;
    setMessage(
      skipped > 0
        ? `Linked ${linked}. ${skipped} already attached.`
        : `Linked ${linked} document${linked === 1 ? "" : "s"} without copying files.`,
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface-muted p-3">
      <p className="text-xs font-medium text-ink">Attach existing</p>
      <p className="text-[11px] text-ink-muted">
        Same-deal metadata only. Linking does not copy or re-upload a file.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search filenames"
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink"
        />
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink"
        >
          <option value="all">All types</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink"
        >
          <option value="all">All statuses</option>
          <option value="received">received</option>
          <option value="needs_review">needs review</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>
      </div>
      <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
        {visible.length === 0 ? (
          <li className="text-ink-muted">No eligible documents on this deal.</li>
        ) : (
          visible.map((doc) => (
            <li key={doc.id}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(doc.id)}
                  onChange={(event) => {
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, doc.id]
                        : current.filter((id) => id !== doc.id),
                    );
                  }}
                />
                <span className="font-medium text-ink">{doc.fileName}</span>
                <span className="text-ink-muted">
                  {doc.documentType ?? "—"} · {doc.status.replaceAll("_", " ")}
                </span>
              </label>
            </li>
          ))
        )}
      </ul>
      <button
        type="button"
        disabled={selected.length === 0}
        onClick={() => void attach()}
        className="rounded-lg bg-pillar-navy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        Attach selected
      </button>
      {message ? <p className="text-xs text-pillar-teal">{message}</p> : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
