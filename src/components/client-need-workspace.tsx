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
import { formatPercent, formatStatusLabel, formatTimestamp } from "@/lib/format";
import { updateNeedStatusAction } from "@/lib/workflow/actions";

const SUMMARY_CHIPS = [
  { key: "requested", label: "Requested", match: "requested" },
  { key: "received", label: "Received", match: "received" },
  { key: "needs_review", label: "Needs review", match: "needs_review" },
  { key: "approved", label: "Approved", match: "approved" },
  { key: "replacement", label: "Replacement needed", match: "rejected" },
] as const;

const NEED_GROUPS = [
  { key: "required_now", label: "Required now" },
  { key: "required_later", label: "Required later" },
  { key: "optional", label: "Optional" },
  { key: "other", label: "Other" },
] as const;

function needGroupKey(timing: string | null | undefined): (typeof NEED_GROUPS)[number]["key"] {
  if (timing === "required_now" || timing === "required_later" || timing === "optional") {
    return timing;
  }
  return "other";
}

function needStatusLine(
  need: ClientNeedRow,
  progress: ReturnType<typeof summarizeNeedDocuments>,
  hint: string,
): string {
  if (need.status === "approved") {
    return "Approved";
  }
  if (need.status === "waived") {
    return "Waived";
  }
  if (need.status === "rejected") {
    return hint === "Replacement received" ? "Replacement received" : "Replacement needed";
  }
  if (need.status === "received" || need.status === "needs_review") {
    const review =
      hint !== progress.receivedLabel ? hint : "Needs review";
    return `${progress.receivedLabel} · ${review}`;
  }
  if (need.status === "missing" || need.status === "requested") {
    return "Missing";
  }
  return formatStatusLabel(need.status);
}

function needCollapsedAction(need: ClientNeedRow, hint: string): "review" | "request" | null {
  if (
    need.status === "received" ||
    need.status === "needs_review" ||
    hint === "Replacement received" ||
    hint === "Possible mismatch" ||
    hint === "Review needed"
  ) {
    return "review";
  }
  if (need.status === "missing" || need.status === "requested") {
    return "request";
  }
  return null;
}

function NeedGlyph({ status }: { status: string }) {
  const tone =
    status === "approved" || status === "waived"
      ? "text-success"
      : status === "rejected"
        ? "text-danger"
        : status === "received" || status === "needs_review"
          ? "text-pillar-teal"
          : "text-ink-muted";
  return (
    <span
      aria-hidden
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center ${tone}`}
      title={status === "rejected" ? "Replacement needed" : formatStatusLabel(status)}
    >
      {status === "approved" || status === "waived" ? (
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 8.1 7.1 10.2 11 6.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : status === "rejected" ? (
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 5v4.2M8 11.2h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : status === "received" || status === "needs_review" ? (
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
          <circle cx="8" cy="8" r="5" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )}
    </span>
  );
}

export function ClientNeedsWorkspace({
  dealId,
  needs,
  documents,
  canMutate,
  canIntake,
  needOps = [],
}: {
  dealId: string;
  needs: ClientNeedRow[];
  documents: DocumentRow[];
  canMutate: boolean;
  canIntake: boolean;
  needOps?: {
    needId: string;
    timing: string | null;
    sourceType: string | null;
    nextAction: string | null;
    contactMissing: boolean;
    mismatch?: boolean;
    replacementCandidate?: boolean;
    reviewNeeded?: boolean;
  }[];
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

  const openCount = SUMMARY_CHIPS.reduce((sum, chip) => sum + (counts[chip.key] ?? 0), 0);
  const grouped = NEED_GROUPS.map((group) => ({
    ...group,
    rows: needs.filter((need) => {
      const timing = needOps.find((item) => item.needId === need.id)?.timing ?? null;
      return needGroupKey(timing) === group.key;
    }),
  })).filter((group) => group.rows.length > 0);
  const showGroups = needOps.some((item) => item.timing);

  return (
    <div className="space-y-5">
      <p className="px-1 text-xs text-ink-muted">
        {needs.length} item{needs.length === 1 ? "" : "s"}
        {openCount > 0 ? ` · ${counts.approved ?? 0} approved` : ""}
      </p>

      {grouped.map((group) => (
        <section key={group.key}>
          {showGroups ? (
            <h3 className="mb-1 px-1 text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
              {group.label}
            </h3>
          ) : null}
          <div className="divide-y divide-line border-y border-line">
            {group.rows.map((need) => {
              const linked = documents.filter((doc) => doc.linkedNeedIds.includes(need.id));
              const progress = summarizeNeedDocuments(linked, need.expectedDocumentCount);
              const ops = needOps.find((item) => item.needId === need.id);
              const open = openId === need.id;
              const hint = ops?.replacementCandidate
                ? "Replacement received"
                : ops?.mismatch
                  ? "Possible mismatch"
                  : ops?.reviewNeeded
                    ? "Review needed"
                    : ops?.contactMissing
                      ? "Contact missing"
                      : progress.receivedLabel;
              const action = needCollapsedAction(need, hint);
              return (
                <article key={need.id}>
                  <div className="flex items-center gap-3 px-1 py-3.5">
                    <NeedGlyph status={need.status} />
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : need.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-sm font-medium text-ink">{need.documentType}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {needStatusLine(need, progress, hint)}
                      </p>
                    </button>
                    {!open && action ? (
                      <button
                        type="button"
                        className="shrink-0 text-xs font-medium text-pillar-teal hover:text-pillar-navy"
                        onClick={() => {
                          if (action === "request" && need.status === "missing") {
                            void runNeedStatus(need.id, "requested");
                            return;
                          }
                          setOpenId(need.id);
                        }}
                      >
                        {action === "review" ? "Review document →" : "Prepare request →"}
                      </button>
                    ) : null}
                    {canMutate && open ? (
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
        </section>
      ))}
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
    items.push({ label: "Approve", onClick: actions.onApprove });
  }
  if (status !== "rejected") {
    items.push({ label: "Get replacement", onClick: actions.onReplace });
  }
  items.push({ label: "Attach existing", onClick: actions.onAttach });
  items.push({ label: "Duplicate item", onClick: actions.onClone });
  if (status !== "requested") {
    items.push({ label: "Prepare request", onClick: actions.onRequest });
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
    <div className="ml-8 space-y-4 rounded-[14px] bg-surface-muted px-3 py-3.5 transition duration-200 motion-reduce:transition-none">
      {need.description ? (
        <p className="text-xs leading-5 text-ink-muted">{need.description}</p>
      ) : null}
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
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] tracking-wide text-ink-muted uppercase">
                <tr>
                  <th className="px-3 py-2">Filename</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Uploaded</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-ink-muted/70">AI class</th>
                  <th className="px-3 py-2 text-ink-muted/70">Confidence</th>
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
                    <td className="px-3 py-2 text-xs text-ink-muted/70">
                      {doc.aiClassification ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums text-ink-muted/70">
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
            {need.status !== "approved" ? (
              <button
                type="button"
                className={buttonClass("accent", "sm")}
                onClick={() => void runNeedStatus(need.id, "approved")}
              >
                Approve
              </button>
            ) : null}
            {need.status !== "rejected" ? (
              <button
                type="button"
                className={buttonClass("secondary", "sm")}
                onClick={() => void runNeedStatus(need.id, "rejected")}
              >
                Replace
              </button>
            ) : null}
            <button type="button" className={buttonClass("secondary", "sm")} onClick={onToggleAttach}>
              Attach Existing
            </button>
            <button
              type="button"
              className={buttonClass("ghost", "sm")}
              onClick={() => void runNeedStatus(need.id, "waived")}
            >
              Waive
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <NeedStatusControl needId={need.id} status={need.status} />
            <button
              type="button"
              className={buttonClass("ghost", "sm")}
              onClick={() => void runNeedStatus(need.id, "requested")}
            >
              Mark Requested
            </button>
            <button
              type="button"
              className={buttonClass("ghost", "sm")}
              onClick={() => void cloneNeed(dealId, need.id)}
            >
              Clone Need
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
