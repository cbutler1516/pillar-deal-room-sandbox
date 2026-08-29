"use client";

import { useState } from "react";
import {
  claimDealAction,
  unclaimDealAction,
  updateDealStatusAction,
  updateDocumentStatusAction,
  updateNeedStatusAction,
  updateTaskStatusAction,
} from "@/lib/workflow/actions";
import {
  DEAL_STATUSES,
  DOCUMENT_STATUSES,
  NEED_STATUSES,
} from "@/lib/ops/workflow";

async function submitClaim(formData: FormData) {
  await claimDealAction(formData);
}

async function submitUnclaim(formData: FormData) {
  await unclaimDealAction(formData);
}

async function submitNeedStatus(formData: FormData) {
  await updateNeedStatusAction(formData);
}

async function submitDocumentStatus(formData: FormData) {
  await updateDocumentStatusAction(formData);
}

async function submitTaskStatus(formData: FormData) {
  await updateTaskStatusAction(formData);
}

function StatusFields({
  idName,
  idValue,
  options,
  current,
}: {
  idName: string;
  idValue: string;
  options: readonly string[];
  current: string;
}) {
  return (
    <>
      <input type="hidden" name={idName} value={idValue} />
      <select
        name="status"
        defaultValue={current}
        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-muted"
      >
        Save
      </button>
    </>
  );
}

export function ClaimButton({ dealId }: { dealId: string }) {
  return (
    <form action={submitClaim}>
      <input type="hidden" name="dealId" value={dealId} />
      <button
        type="submit"
        className="rounded-lg bg-pillar-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-pillar-navy-soft"
      >
        Claim deal
      </button>
    </form>
  );
}

export function UnclaimButton({ dealId }: { dealId: string }) {
  return (
    <form action={submitUnclaim}>
      <input type="hidden" name="dealId" value={dealId} />
      <button
        type="submit"
        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted"
      >
        Unclaim
      </button>
    </form>
  );
}

export function DealStatusControl({
  dealId,
  status,
}: {
  dealId: string;
  status: string;
}) {
  const [error, setError] = useState<string | null>(null);

  async function submitDealStatus(formData: FormData) {
    setError(null);
    const result = await updateDealStatusAction(formData);
    if (result.error) {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-1">
      <form action={submitDealStatus} className="flex items-center gap-2">
        <StatusFields
          idName="dealId"
          idValue={dealId}
          options={DEAL_STATUSES}
          current={status}
        />
      </form>
      {error ? <p className="max-w-xs text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}

export function NeedStatusControl({
  needId,
  status,
}: {
  needId: string;
  status: string;
}) {
  return (
    <form action={submitNeedStatus} className="flex items-center gap-2">
      <StatusFields
        idName="needId"
        idValue={needId}
        options={NEED_STATUSES}
        current={status}
      />
    </form>
  );
}

export function DocumentStatusControl({
  documentId,
  status,
}: {
  documentId: string;
  status: string;
}) {
  return (
    <form action={submitDocumentStatus} className="flex items-center gap-2">
      <StatusFields
        idName="documentId"
        idValue={documentId}
        options={DOCUMENT_STATUSES}
        current={status}
      />
    </form>
  );
}

export function TaskActions({ taskId }: { taskId: string }) {
  return (
    <div className="flex gap-2">
      <form action={submitTaskStatus}>
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="status" value="completed" />
        <button
          type="submit"
          className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-muted"
        >
          Complete
        </button>
      </form>
      <form action={submitTaskStatus}>
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="status" value="dismissed" />
        <button
          type="submit"
          className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-muted"
        >
          Dismiss
        </button>
      </form>
    </div>
  );
}
