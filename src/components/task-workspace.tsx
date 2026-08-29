"use client";

import { useState, type ReactNode } from "react";
import { ContactsWorkspace } from "@/components/contacts-workspace";
import { CopyTextButton } from "@/components/copy-text-button";
import { StatusChip } from "@/components/status-chip";
import { addContactLabel } from "@/lib/contacts/logic";
import type { ClientNeedRow, DealContactRow, TaskRow } from "@/lib/data/deals";
import {
  formatCadenceHours,
  formatFollowUpAt,
  formatTimestamp,
  formatWaitingAge,
} from "@/lib/format";
import {
  completeTaskAction,
  createTaskFromPlaybookAction,
  dismissTaskAction,
  escalateTaskAction,
  generateBaselineTasksAction,
  markTaskContactedAction,
  markTaskWaitingAction,
  setTaskFollowUpAction,
  startTaskAction,
  updateTaskContactAction,
} from "@/lib/playbooks/actions";
import {
  applyPlaybookContactRequirement,
  escalationLabel,
  isContactMissing,
  isEscalationDue,
  isFollowUpDue,
  taskTimingGroup,
  waitingAgeHours,
} from "@/lib/playbooks/logic";
import { getPlaybook } from "@/lib/playbooks/registry";
import {
  renderRequestTemplate,
  requestSummaryFromTemplate,
  templateContextFromDeal,
} from "@/lib/playbooks/templates";
import { TASK_TIMINGS, type PlaybookDefinition } from "@/lib/playbooks/types";

const GROUPS = [
  { key: "required_now", label: "Required Now" },
  { key: "required_later", label: "Required Later" },
  { key: "optional", label: "Optional" },
  { key: "completed", label: "Completed" },
] as const;

async function submitStart(formData: FormData) {
  await startTaskAction(formData);
}
async function submitContacted(formData: FormData) {
  await markTaskContactedAction(formData);
}
async function submitWaiting(formData: FormData) {
  await markTaskWaitingAction(formData);
}
async function submitComplete(formData: FormData) {
  await completeTaskAction(formData);
}
async function submitDismiss(formData: FormData) {
  await dismissTaskAction(formData);
}
async function submitContact(formData: FormData) {
  await updateTaskContactAction(formData);
}
async function submitFollowUp(formData: FormData) {
  await setTaskFollowUpAction(formData);
}
async function submitEscalate(formData: FormData) {
  await escalateTaskAction(formData);
}
async function submitCreate(formData: FormData) {
  await createTaskFromPlaybookAction(formData);
}
async function submitBaseline(formData: FormData) {
  await generateBaselineTasksAction(formData);
}

export type DealRequestContext = {
  borrowerName: string | null;
  entityName: string | null;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  loanType: string | null;
  dealReference: string | null;
};

export function TaskWorkspace({
  dealId,
  loanType,
  dealContext,
  tasks,
  needs,
  contacts,
  playbooks,
  canMutate,
  canGenerateBaseline,
}: {
  dealId: string;
  loanType: string | null;
  dealContext: DealRequestContext;
  tasks: TaskRow[];
  needs: Pick<ClientNeedRow, "id" | "documentType" | "expectedDocumentCount">[];
  contacts: DealContactRow[];
  playbooks: Pick<
    PlaybookDefinition,
    "playbookKey" | "title" | "sourceType" | "taskKind" | "timing"
  >[];
  canMutate: boolean;
  canGenerateBaseline: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const now = new Date();

  return (
    <div className="space-y-4">
      {canMutate ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAdd((value) => !value)}
            className="rounded-lg bg-pillar-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-pillar-navy-soft"
          >
            Add Task
          </button>
          {canGenerateBaseline ? (
            <form action={submitBaseline}>
              <input type="hidden" name="dealId" value={dealId} />
              <button
                type="submit"
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted"
              >
                Generate {loanType ?? "loan type"} baseline
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {showAdd && canMutate ? (
        <AddTaskForm
          dealId={dealId}
          needs={needs}
          playbooks={playbooks}
          onClose={() => setShowAdd(false)}
        />
      ) : null}

      {tasks.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No processor actions are on this file yet.
        </p>
      ) : (
        GROUPS.map((group) => {
          const rows = tasks.filter((task) => taskTimingGroup(task) === group.key);
          if (rows.length === 0) {
            return null;
          }
          return (
            <section key={group.key}>
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                {group.label}
              </h4>
              <ul className="space-y-2">
                {rows.map((task) => {
                  const open = openId === task.id;
                  const followUpDue = isFollowUpDue(task, now);
                  const escalationDue = isEscalationDue(task, now);
                  const decorated = applyPlaybookContactRequirement({
                    ...task,
                    dealContactId: task.dealContactId,
                    blockedReason: task.blockedReason,
                  });
                  const missing = isContactMissing(decorated);
                  return (
                    <li key={task.id} className="rounded-xl border border-line bg-surface-muted/40">
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : task.id)}
                        className="flex w-full flex-wrap items-center justify-between gap-3 px-3 py-2 text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">
                            {task.title}
                          </p>
                          <p
                            className={`mt-1 text-xs font-medium ${
                              followUpDue ? "text-warning" : "text-ink"
                            }`}
                          >
                            Next follow-up {formatFollowUpAt(task.nextFollowUpAt)}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {task.contactName || "No contact"}
                            {task.status === "waiting" ? " · Waiting" : ""}
                            {task.assignedTo ? " · Assigned" : " · Unassigned"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {task.sourceType ? (
                            <StatusChip status={task.sourceType} />
                          ) : null}
                          <StatusChip status={task.status} />
                          <StatusChip status={task.priority} />
                          {missing ? (
                            <span className="text-[11px] font-medium text-danger">
                              Blocked — contact missing
                            </span>
                          ) : null}
                          {followUpDue ? (
                            <span className="text-[11px] font-medium text-warning">
                              Follow-up due
                            </span>
                          ) : null}
                          {escalationDue ? (
                            <span className="text-[11px] font-medium text-danger">
                              {escalationLabel(task.escalationLevel, true)}
                            </span>
                          ) : null}
                          <span className="text-xs text-ink-muted">
                            {task.assignedTo ? "Assigned" : "Unassigned"}
                          </span>
                        </div>
                      </button>
                      {open ? (
                        <TaskDetail
                          task={task}
                          needs={needs}
                          contacts={contacts}
                          dealContext={dealContext}
                          canMutate={canMutate}
                          now={now}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

function TaskDetail({
  task,
  needs,
  contacts,
  dealContext,
  canMutate,
  now,
}: {
  task: TaskRow;
  needs: Pick<ClientNeedRow, "id" | "documentType" | "expectedDocumentCount">[];
  contacts: DealContactRow[];
  dealContext: DealRequestContext;
  canMutate: boolean;
  now: Date;
}) {
  const linkedNeed = needs.find((need) => need.id === task.clientNeedId);
  const linkedContact = contacts.find((contact) => contact.id === task.dealContactId);
  const playbook = task.playbookKey ? getPlaybook(task.playbookKey) : null;
  const decorated = applyPlaybookContactRequirement({
    ...task,
    dealContactId: task.dealContactId,
    blockedReason: task.blockedReason,
  });
  const missing = isContactMissing(decorated);
  const suggested = renderRequestTemplate(
    playbook?.requestSummary ?? playbook?.requestTemplate,
    templateContextFromDeal({
      ...dealContext,
      contactName: linkedContact?.name ?? task.contactName,
      expectedDocumentCount: linkedNeed?.expectedDocumentCount ?? 2,
    }),
  );
  const requestText = renderRequestTemplate(
    playbook?.requestTemplate,
    templateContextFromDeal({
      ...dealContext,
      contactName: linkedContact?.name ?? task.contactName,
      expectedDocumentCount: linkedNeed?.expectedDocumentCount ?? 2,
    }),
  );
  const active =
    task.status === "open" ||
    task.status === "in_progress" ||
    task.status === "waiting";

  return (
    <div className="space-y-4 border-t border-line px-3 py-3">
      {missing ? (
        <div className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2">
          <p className="text-sm font-medium text-danger">
            Blocked — contact missing
          </p>
          <p className="mt-1 text-xs text-danger">
            {addContactLabel(decorated.expectedContactType)} before this task can
            be worked.
          </p>
          {canMutate ? (
            <div className="mt-2">
              <ContactsWorkspace
                dealId={task.dealId}
                contacts={contacts}
                canMutate={canMutate}
                defaultType={decorated.expectedContactType ?? undefined}
                taskId={task.id}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <Section title="What to do">
        {task.instructions || task.description || "No instructions on this task."}
      </Section>
      <Section title="Who to contact">
        {linkedContact || task.contactName ? (
          <>
            {[linkedContact?.name ?? task.contactName, linkedContact?.company]
              .filter(Boolean)
              .join(" — ")}
            {linkedContact || task.sourceType
              ? ` · ${(linkedContact?.contactType ?? task.sourceType ?? "").replaceAll("_", " ")}`
              : ""}
            {` · ${linkedContact?.email ?? task.contactEmail ?? "No email"}`}
            {` · ${linkedContact?.phone ?? task.contactPhone ?? "No phone"}`}
          </>
        ) : (
          "No contact linked."
        )}
      </Section>
      <Section title="What to request">
        {requestSummaryFromTemplate(suggested) || "Use the playbook instructions."}
      </Section>
      {requestText ? (
        <div>
          <h5 className="text-xs font-semibold text-ink-muted uppercase">
            Suggested request text
          </h5>
          <p className="mt-1 text-sm text-ink">{requestText}</p>
          <div className="mt-2">
            <CopyTextButton value={requestText} label="Copy Request" />
          </div>
        </div>
      ) : null}
      <Section title="Completion rule">
        {task.completionRule ??
          "Processor marks accepted. No underwriting conclusion."}
      </Section>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Item label="Last contacted" value={formatTimestamp(task.lastContactedAt)} />
        <Item label="Next follow-up" value={formatFollowUpAt(task.nextFollowUpAt, now)} />
        <Item
          label="Follow-up cadence"
          value={formatCadenceHours(task.followUpIntervalHours)}
        />
        <Item
          label="Escalation timing"
          value={
            task.escalationAfterHours
              ? `Escalate after ${task.escalationAfterHours}h · ${escalationLabel(task.escalationLevel, isEscalationDue(task, now))}`
              : escalationLabel(task.escalationLevel, isEscalationDue(task, now))
          }
        />
        <Item
          label="Waiting status"
          value={
            task.status === "waiting"
              ? `Waiting ${formatWaitingAge(waitingAgeHours(task, now))}`
              : task.status.replaceAll("_", " ")
          }
        />
        <Item
          label="Owner"
          value={task.assignedTo ? "Assigned processor" : "Unassigned"}
        />
        <Item label="Linked Client Need" value={linkedNeed?.documentType ?? "None"} />
      </dl>

      {canMutate && active ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {task.status !== "in_progress" ? (
              <form action={submitStart}>
                <input type="hidden" name="taskId" value={task.id} />
                <button type="submit" className={actionClass}>
                  Start
                </button>
              </form>
            ) : null}
            <form action={submitContacted}>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="markWaiting" value="true" />
              <button type="submit" className={actionClass}>
                Mark Contacted
              </button>
            </form>
            {task.status !== "waiting" ? (
              <form action={submitWaiting}>
                <input type="hidden" name="taskId" value={task.id} />
                <button type="submit" className={actionClass}>
                  Mark Waiting
                </button>
              </form>
            ) : null}
            <form action={submitComplete}>
              <input type="hidden" name="taskId" value={task.id} />
              <button type="submit" className={actionClass}>
                Complete
              </button>
            </form>
            <form action={submitDismiss}>
              <input type="hidden" name="taskId" value={task.id} />
              <button type="submit" className={actionClass}>
                Dismiss
              </button>
            </form>
            <form action={submitEscalate}>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="escalationLevel" value="loan_officer" />
              <button type="submit" className={actionClass}>
                Escalate
              </button>
            </form>
          </div>

          <form action={submitContact} className="grid gap-2 sm:grid-cols-4">
            <input type="hidden" name="taskId" value={task.id} />
            <input
              name="contactName"
              defaultValue={task.contactName ?? ""}
              placeholder="Contact name"
              className={inputClass}
            />
            <input
              name="contactEmail"
              defaultValue={task.contactEmail ?? ""}
              placeholder="Contact email"
              className={inputClass}
            />
            <input
              name="contactPhone"
              defaultValue={task.contactPhone ?? ""}
              placeholder="Contact phone"
              className={inputClass}
            />
            <button type="submit" className={actionClass}>
              Update contact
            </button>
          </form>

          <form action={submitFollowUp} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="taskId" value={task.id} />
            <label className="text-xs text-ink-muted">
              Set follow-up
              <input
                type="datetime-local"
                name="nextFollowUpAt"
                className={`${inputClass} ml-2`}
                required
              />
            </label>
            <button type="submit" className={actionClass}>
              Set Follow-Up
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function AddTaskForm({
  dealId,
  needs,
  playbooks,
  onClose,
}: {
  dealId: string;
  needs: Pick<ClientNeedRow, "id" | "documentType">[];
  playbooks: Pick<
    PlaybookDefinition,
    "playbookKey" | "title" | "sourceType" | "taskKind" | "timing"
  >[];
  onClose: () => void;
}) {
  return (
    <form
      action={async (formData) => {
        await submitCreate(formData);
        onClose();
      }}
      className="space-y-3 rounded-xl border border-line bg-surface-muted p-3"
    >
      <input type="hidden" name="dealId" value={dealId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-ink-muted">
          Playbook
          <select name="playbookKey" required className={`${inputClass} mt-1 w-full`}>
            <option value="">Select a playbook</option>
            {playbooks.map((playbook) => (
              <option key={playbook.playbookKey} value={playbook.playbookKey}>
                {playbook.title} · {playbook.sourceType.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-muted">
          Timing override
          <select name="timing" className={`${inputClass} mt-1 w-full`}>
            <option value="">Use playbook default</option>
            {TASK_TIMINGS.map((timing) => (
              <option key={timing} value={timing}>
                {timing.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-muted">
          Linked Client Need
          <select name="clientNeedId" className={`${inputClass} mt-1 w-full`}>
            <option value="">Match or create if needed</option>
            {needs.map((need) => (
              <option key={need.id} value={need.id}>
                {need.documentType}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-muted">
          Due date
          <input type="datetime-local" name="dueAt" className={`${inputClass} mt-1 w-full`} />
        </label>
        <input name="contactName" placeholder="Contact name" className={inputClass} />
        <input name="contactEmail" placeholder="Contact email" className={inputClass} />
        <input name="contactPhone" placeholder="Contact phone" className={inputClass} />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-pillar-navy px-3 py-1.5 text-xs font-medium text-white"
        >
          Create from playbook
        </button>
        <button type="button" onClick={onClose} className={actionClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h5 className="text-xs font-semibold text-ink-muted uppercase">{title}</h5>
      <p className="mt-1 text-sm text-ink">{children}</p>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
    </div>
  );
}

const actionClass =
  "rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-muted";
const inputClass =
  "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink";
