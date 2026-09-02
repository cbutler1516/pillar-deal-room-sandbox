"use client";

import { useState } from "react";
import {
  clearConditionAction,
  createConditionAction,
} from "@/lib/conditions/actions";
import {
  conditionStatus,
  conditionStatusLabel,
  isLenderCondition,
  parseConditionSource,
} from "@/lib/conditions/model";
import { buttonClass } from "@/components/ui/button";
import { StaffPresence } from "@/components/ui/staff-avatar";
import { surfaceClass } from "@/components/ui/styles";
import type { ClientNeedRow, TaskRow } from "@/lib/data/deals";
import { formatFollowUpAt } from "@/lib/format";
import { TASK_TIMINGS } from "@/lib/playbooks/types";

export function ConditionsWorkspace({
  dealId,
  tasks,
  needs,
  staffNames,
  canMutate,
  nowMs,
}: {
  dealId: string;
  tasks: TaskRow[];
  needs: Pick<ClientNeedRow, "id" | "documentType" | "status">[];
  staffNames: Record<string, string>;
  canMutate: boolean;
  nowMs: number;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = new Date(nowMs);
  const rows = tasks.filter((task) => isLenderCondition(task));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink">
            Conditions
          </h3>
          <p className="mt-0.5 max-w-2xl text-xs leading-5 text-ink-muted">
            Lender requirements on this file. Nothing is sent automatically.
          </p>
        </div>
        {canMutate ? (
          <button
            type="button"
            className={buttonClass("secondary", "sm")}
            onClick={() => setShowAdd((value) => !value)}
          >
            {showAdd ? "Cancel" : "Add condition"}
          </button>
        ) : null}
      </div>

      {showAdd && canMutate ? (
        <AddConditionForm
          dealId={dealId}
          needs={needs}
          onClose={() => setShowAdd(false)}
        />
      ) : null}

      {rows.length === 0 ? (
        <p className="border border-dashed border-line bg-stone/40 px-4 py-6 text-sm text-ink-muted">
          No lender conditions on this file yet.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((task) => {
            const need = needs.find((row) => row.id === task.clientNeedId);
            const status = conditionStatus(task, need);
            const source = parseConditionSource(task.instructions);
            return (
              <li
                key={task.id}
                className={`${surfaceClass("card")} px-4 py-3.5`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{task.title}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {[source, need?.documentType, task.contactName]
                        .filter(Boolean)
                        .join(" · ") || "Lender condition"}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {conditionStatusLabel(status)}
                      {task.nextFollowUpAt
                        ? ` · Follow-up ${formatFollowUpAt(task.nextFollowUpAt, now)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StaffPresence
                      name={
                        task.assignedTo
                          ? staffNames[task.assignedTo] ?? null
                          : null
                      }
                      unassigned={!task.assignedTo}
                    />
                    {status === "cleared" ? (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                        Cleared
                      </span>
                    ) : canMutate ? (
                      <button
                        type="button"
                        className={buttonClass("accent", "sm")}
                        onClick={() => {
                          const data = new FormData();
                          data.set("taskId", task.id);
                          setError(null);
                          void clearConditionAction(data).then((result) => {
                            if (result.error) setError(result.error);
                          });
                        }}
                      >
                        Clear condition
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

function AddConditionForm({
  dealId,
  needs,
  onClose,
}: {
  dealId: string;
  needs: Pick<ClientNeedRow, "id" | "documentType">[];
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className={`${surfaceClass("elevated")} space-y-3 px-4 py-4`}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        data.set("dealId", dealId);
        setPending(true);
        setError(null);
        void createConditionAction(data).then((result) => {
          setPending(false);
          if (result.error) {
            setError(result.error);
            return;
          }
          onClose();
        });
      }}
    >
      <label className="block text-xs font-medium text-ink-muted">
        Condition
        <input
          name="title"
          required
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-ink-muted">
          Source / lender name
          <input
            name="source"
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
            placeholder="Lender"
          />
        </label>
        <label className="block text-xs font-medium text-ink-muted">
          Timing
          <select
            name="timing"
            defaultValue="required_now"
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
          >
            {TASK_TIMINGS.map((timing) => (
              <option key={timing} value={timing}>
                {timing === "required_now"
                  ? "Needed now"
                  : timing === "required_later"
                    ? "Needed later"
                    : "Optional"}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-ink-muted">
          Who we need it from
          <input
            name="contactName"
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="block text-xs font-medium text-ink-muted">
          Related Need
          <select
            name="clientNeedId"
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="">None</option>
            {needs.map((need) => (
              <option key={need.id} value={need.id}>
                {need.documentType}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs font-medium text-ink-muted">
        Notes
        <textarea
          name="notes"
          rows={2}
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="block text-xs font-medium text-ink-muted">
        Due / follow-up
        <input
          name="dueAt"
          type="datetime-local"
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
        />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button type="submit" className={buttonClass("accent")} disabled={pending}>
        Add condition
      </button>
    </form>
  );
}
