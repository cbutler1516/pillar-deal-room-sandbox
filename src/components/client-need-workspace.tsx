"use client";

import { useMemo, useState } from "react";
import { AttachExistingPanel } from "@/components/attach-existing-panel";
import { TemporaryAccessControl } from "@/components/document-intake-panel";
import { StatusChip } from "@/components/status-chip";
import { OverflowMenu } from "@/components/ui/overflow-menu";
import { buttonClass } from "@/components/ui/button";
import { NeedStatusControl } from "@/components/workflow-controls";
import type { ClientNeedRow, DocumentRow } from "@/lib/data/deals";
import {
  cloneClientNeedAction,
  detachExistingAction,
  updateNeedNotesAction,
} from "@/lib/documents/link-actions";
import { summarizeNeedDocuments } from "@/lib/documents/need-progress";
import { formatPercent, formatTimestamp } from "@/lib/format";
import { updateNeedStatusAction } from "@/lib/workflow/actions";

const SUMMARY_CHIPS = [
  { key: "requested", label: "Requested", match: "requested" },
  { key: "received", label: "Received", match: "received" },
  { key: "needs_review", label: "Needs Review", match: "needs_review" },
  { key: "approved", label: "Approved", match: "approved" },
  { key: "replacement", label: "Replacement Needed", match: "rejected" },
] as const;

export function ClientNeedsWorkspace({
  dealId,
  needs,
  documents,
  canMutate,
  canIntake,
}: {
  dealId: string;
  needs: ClientNeedRow[];
  documents: DocumentRow[];
  canMutate: boolean;
  canIntake: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [attachFor, setAttachFor] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const counts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const chip of SUMMARY_CHIPS) {
      next[chip.key] = needs.filter((need) => need.status === chip.match).length;
    }
    return next;
  }, [needs]);

  if (needs.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No Client Needs are on this file yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {SUMMARY_CHIPS.map((chip) => (
          <span
            key={chip.key}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-ink"
          >
            {chip.label}
            <span className="text-ink-muted">{counts[chip.key] ?? 0}</span>
          </span>
        ))}
      </div>

      <div className="divide-y divide-line border-y border-line">
        {needs.map((need) => {
          const linked = documents.filter((doc) => doc.linkedNeedIds.includes(need.id));
          const progress = summarizeNeedDocuments(linked, need.expectedDocumentCount);
          const open = openId === need.id;
          return (
            <article key={need.id}>
              <div className="grid items-center gap-3 px-4 py-2.5 lg:grid-cols-[minmax(0,1.3fr)_minmax(10rem,1fr)_auto]">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : need.id)}
                  className="min-w-0 text-left"
                >
                  <p className="text-sm font-semibold text-ink">{need.documentType}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {need.description || need.category}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : need.id)}
                  className="text-left text-xs text-ink-muted"
                >
                  <p className="font-medium text-ink">{progress.receivedLabel}</p>
                  {progress.reviewLabel ? (
                    <p>{progress.reviewLabel.replaceAll(", ", " · ")}</p>
                  ) : null}
                </button>
                <div className="flex items-center justify-end gap-2">
                  <StatusChip
                    status={need.status}
                    label={
                      need.status === "rejected" ? "Replacement Needed" : undefined
                    }
                  />
                  {canMutate ? (
                    <OverflowMenu
                      items={needOverflowItems(need.status, {
                        onApprove: () => void runNeedStatus(need.id, "approved"),
                        onReplace: () => void runNeedStatus(need.id, "rejected"),
                        onAttach: () => {
                          setOpenId(need.id);
                          setAttachFor(need.id);
                        },
                        onClone: () => void cloneNeed(dealId, need.id),
                        onRequest: () => void runNeedStatus(need.id, "requested"),
                        onWaive: () => void runNeedStatus(need.id, "waived"),
                        onNote: () => {
                          setOpenId(need.id);
                          setNoteFor(need.id);
                        },
                      })}
                    />
                  ) : null}
                </div>
              </div>
              {open ? (
                <NeedReviewPanel
                  dealId={dealId}
                  need={need}
                  linked={linked}
                  progress={progress}
                  documents={documents}
                  canMutate={canMutate}
                  canIntake={canIntake}
                  showAttach={attachFor === need.id}
                  showNotes={noteFor === need.id}
                  onToggleAttach={() =>
                    setAttachFor((current) => (current === need.id ? null : need.id))
                  }
                />
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

async function runNeedStatus(needId: string, status: string) {
  const formData = new FormData();
  formData.set("needId", needId);
  formData.set("status", status);
  await updateNeedStatusAction(formData);
}

async function cloneNeed(dealId: string, clientNeedId: string) {
  const formData = new FormData();
  formData.set("dealId", dealId);
  formData.set("clientNeedId", clientNeedId);
  await cloneClientNeedAction(formData);
}

function needOverflowItems(
  status: string,
  actions: {
    onApprove: () => void;
    onReplace: () => void;
    onAttach: () => void;
    onClone: () => void;
    onRequest: () => void;
    onWaive: () => void;
    onNote: () => void;
  },
) {
  const items: { label: string; onClick: () => void; tone?: "default" | "danger" }[] =
    [];
  if (status !== "approved") {
    items.push({ label: "Approve Need", onClick: actions.onApprove });
  }
  if (status !== "rejected") {
    items.push({ label: "Request Replacement", onClick: actions.onReplace });
  }
  items.push({ label: "Attach Existing", onClick: actions.onAttach });
  items.push({ label: "Clone Need", onClick: actions.onClone });
  if (status !== "requested") {
    items.push({ label: "Mark Requested", onClick: actions.onRequest });
  }
  if (status !== "waived") {
    items.push({ label: "Waive", onClick: actions.onWaive });
  }
  items.push({ label: "Add Note", onClick: actions.onNote });
  return items;
}

function NeedReviewPanel({
  dealId,
  need,
  linked,
  progress,
  documents,
  canMutate,
  canIntake,
  showAttach,
  showNotes,
  onToggleAttach,
}: {
  dealId: string;
  need: ClientNeedRow;
  linked: DocumentRow[];
  progress: ReturnType<typeof summarizeNeedDocuments>;
  documents: DocumentRow[];
  canMutate: boolean;
  canIntake: boolean;
  showAttach: boolean;
  showNotes: boolean;
  onToggleAttach: () => void;
}) {
  const [notes, setNotes] = useState(need.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  async function saveNotes() {
    const formData = new FormData();
    formData.set("needId", need.id);
    formData.set("notes", notes);
    const result = await updateNeedNotesAction(formData);
    setError(result.error);
  }

  async function detach(documentId: string) {
    const formData = new FormData();
    formData.set("dealId", dealId);
    formData.set("documentId", documentId);
    formData.set("clientNeedId", need.id);
    const result = await detachExistingAction(formData);
    setError(result.error);
  }

  return (
    <div className="space-y-4 border-t border-line px-4 py-4">
      <div>
        <h4 className="text-sm font-semibold text-ink">{need.documentType}</h4>
        <p className="mt-1 text-xs text-ink-muted">
          {need.description || need.category}
        </p>
      </div>
      <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <Item label="Status" value={need.status.replaceAll("_", " ")} />
        <Item label="Requested" value={formatTimestamp(need.requestedAt)} />
        <Item
          label="Expected count"
          value={
            need.expectedDocumentCount == null
              ? "Not configured"
              : String(need.expectedDocumentCount)
          }
        />
        <Item label="Received" value={String(progress.receivedCount)} />
        <Item label="Approved" value={String(progress.approvedCount)} />
        <Item label="Outstanding" value={progress.outstandingLabel} />
        <Item label="Required" value={need.required ? "Required" : "Optional"} />
        <Item label="Processor notes" value={need.notes} />
      </dl>

      <div>
        <h5 className="mb-2 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
          Linked Documents
        </h5>
        {linked.length === 0 ? (
          <p className="text-sm text-ink-muted">No documents linked to this need.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] tracking-wide text-ink-muted uppercase">
                <tr>
                  <th className="px-3 py-2">Filename</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Uploaded</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">AI class</th>
                  <th className="px-3 py-2">Confidence</th>
                  {canIntake ? <th className="px-3 py-2">Access</th> : null}
                  {canMutate ? <th className="px-3 py-2">Detach</th> : null}
                </tr>
              </thead>
              <tbody>
                {linked.map((doc) => (
                  <tr key={doc.id} className="border-t border-line">
                    <td className="px-3 py-2 font-medium text-ink">{doc.fileName}</td>
                    <td className="px-3 py-2 text-xs text-ink-muted">
                      {doc.documentType ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-muted">
                      {formatTimestamp(doc.uploadedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusChip status={doc.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-muted">
                      {doc.aiClassification ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-muted">
                      {formatPercent(doc.aiConfidence)}
                    </td>
                    {canIntake ? (
                      <td className="px-3 py-2">
                        <TemporaryAccessControl dealId={dealId} documentId={doc.id} />
                      </td>
                    ) : null}
                    {canMutate ? (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => void detach(doc.id)}
                          className={buttonClass("secondary", "sm")}
                        >
                          Detach
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canMutate ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <NeedStatusControl needId={need.id} status={need.status} />
            <button type="button" className={buttonClass("secondary", "sm")} onClick={onToggleAttach}>
              Attach Existing
            </button>
            <button
              type="button"
              className={buttonClass("secondary", "sm")}
              onClick={() => void runNeedStatus(need.id, "approved")}
            >
              Approve Need
            </button>
            <button
              type="button"
              className={buttonClass("secondary", "sm")}
              onClick={() => void runNeedStatus(need.id, "rejected")}
            >
              Request Replacement
            </button>
            <button
              type="button"
              className={buttonClass("secondary", "sm")}
              onClick={() => void runNeedStatus(need.id, "requested")}
            >
              Mark Requested
            </button>
            <button
              type="button"
              className={buttonClass("secondary", "sm")}
              onClick={() => void cloneNeed(dealId, need.id)}
            >
              Clone Need
            </button>
            <button
              type="button"
              className={buttonClass("ghost", "sm")}
              onClick={() => void runNeedStatus(need.id, "waived")}
            >
              Waive
            </button>
          </div>
          <p className="text-[11px] text-ink-muted">
            These actions update workflow state only. No borrower communications are sent.
          </p>
          {showAttach ? (
            <AttachExistingPanel
              dealId={dealId}
              clientNeedId={need.id}
              documents={documents}
            />
          ) : null}
          <label className="block text-xs text-ink-muted">
            Processor notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={showNotes ? 4 : 3}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
            />
          </label>
          <button type="button" className={buttonClass("secondary", "sm")} onClick={() => void saveNotes()}>
            Add Note
          </button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="mt-1 text-ink">{value || "—"}</dd>
    </div>
  );
}
