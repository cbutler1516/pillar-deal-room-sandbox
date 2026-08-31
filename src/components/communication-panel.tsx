"use client";

import { CopyTextButton } from "@/components/copy-text-button";
import { OverflowMenu } from "@/components/ui/overflow-menu";
import { buttonClass } from "@/components/ui/button";
import { communicationAging, formatHoursCompact } from "@/lib/communications/aging";
import {
  markResponseReceivedAction,
  markTaskContactedWithCommunicationAction,
  markTaskWaitingWithCadenceAction,
  recordDraftCopiedAction,
  scheduleFollowUpAction,
  simulateInboundResponseAction,
} from "@/lib/communications/actions";
import {
  buildCommunicationDraft,
  draftTextForChannel,
} from "@/lib/communications/drafts";
import { historyItemsFromAttempts } from "@/lib/communications/history";
import { recommendedDraftForTask } from "@/lib/communications/sequence";
import type { CommunicationAttempt, CommunicationChannel } from "@/lib/communications/types";
import type { DealContactRow, TaskRow } from "@/lib/data/deals";
import { escalateTaskAction } from "@/lib/playbooks/actions";
import { getPlaybook } from "@/lib/playbooks/registry";
import { templateContextFromDeal } from "@/lib/playbooks/templates";

type DealRequestContext = {
  borrowerName: string | null;
  entityName: string | null;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  loanType: string | null;
  dealReference: string | null;
};

export function CommunicationPanel({
  task,
  dealContext,
  contact,
  clientNeed,
  attempts,
  processorName,
  canMutate,
  replacementNeeded = false,
}: {
  task: TaskRow;
  dealContext: DealRequestContext;
  contact: DealContactRow | null;
  clientNeed: string | null;
  attempts: CommunicationAttempt[];
  processorName: string | null;
  canMutate: boolean;
  replacementNeeded?: boolean;
}) {
  const now = new Date();
  const playbook = task.playbookKey ? getPlaybook(task.playbookKey) : null;
  const recommendation = recommendedDraftForTask(
    {
      status: task.status,
      sourceType: task.sourceType,
      lastContactedAt: task.lastContactedAt,
      lastResponseAt: task.lastResponseAt,
      nextFollowUpAt: task.nextFollowUpAt,
      waitingSince: task.waitingSince,
      followUpIntervalHours: task.followUpIntervalHours,
      escalationAfterHours: task.escalationAfterHours,
      escalationLevel: task.escalationLevel,
    },
    { replacementNeeded },
    now,
  );
  const draftType = recommendation.draftType ?? "initial";
  const draft = buildCommunicationDraft({
    draftType,
    audience: task.sourceType === "borrower" ? "borrower" : "internal",
    requestTemplate: playbook?.requestTemplate,
    context: {
      ...templateContextFromDeal({
        ...dealContext,
        contactName: contact?.name ?? task.contactName,
        clientNeed,
        requestedItems: clientNeed,
        processorName,
      }),
      client_need: clientNeed,
      requested_items: clientNeed,
      processor_name: processorName,
    },
  });
  const aging = communicationAging(
    {
      status: task.status,
      sourceType: task.sourceType,
      lastContactedAt: task.lastContactedAt,
      lastResponseAt: task.lastResponseAt,
      nextFollowUpAt: task.nextFollowUpAt,
      waitingSince: task.waitingSince,
      followUpIntervalHours: task.followUpIntervalHours,
      escalationAfterHours: task.escalationAfterHours,
      escalationLevel: task.escalationLevel,
    },
    now,
  );
  const history = historyItemsFromAttempts(
    attempts.filter((item) => item.taskId === task.id),
  );
  const email = draftTextForChannel(draft, "email");
  const active =
    task.status === "open" ||
    task.status === "in_progress" ||
    task.status === "waiting";

  async function copyChannel(channel: CommunicationChannel) {
    const data = new FormData();
    data.set("taskId", task.id);
    data.set("channel", channel);
    data.set("draftType", draft.draftType);
    data.set("audience", draft.audience);
    await recordDraftCopiedAction(data);
  }

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h5 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Communications
          </h5>
          <p className="mt-1 text-sm font-medium text-ink">{aging.label}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {contact?.name ?? task.contactName ?? "No contact"}
            {contact?.email || task.contactEmail
              ? ` · ${contact?.email ?? task.contactEmail}`
              : ""}
            {` · Cadence ${aging.followUpHours}h`}
            {aging.hoursSinceContact != null
              ? ` · Last contact ${formatHoursCompact(aging.hoursSinceContact)} ago`
              : ""}
          </p>
          <p className="mt-1 text-[11px] text-ink-muted">
            Copy only. Nothing is sent from Deal Room.
          </p>
        </div>
        {canMutate && active ? (
          <OverflowMenu
            items={[
              {
                label: "Mark Response Received",
                onClick: () => {
                  const data = new FormData();
                  data.set("taskId", task.id);
                  void markResponseReceivedAction(data);
                },
              },
              ...(task.status !== "waiting"
                ? [
                    {
                      label: "Mark Waiting",
                      onClick: () => {
                        const data = new FormData();
                        data.set("taskId", task.id);
                        void markTaskWaitingWithCadenceAction(data);
                      },
                    },
                  ]
                : []),
              {
                label: "Escalate",
                onClick: () => {
                  const data = new FormData();
                  data.set("taskId", task.id);
                  data.set("escalationLevel", "loan_officer");
                  void escalateTaskAction(data);
                },
              },
              {
                label: "SANDBOX — Simulate Response",
                onClick: () => {
                  const data = new FormData();
                  data.set("taskId", task.id);
                  void simulateInboundResponseAction(data);
                },
              },
            ]}
          />
        ) : null}
      </div>

      <div className="rounded-lg border border-line bg-surface-muted/50 px-3 py-2">
        <p className="text-xs font-semibold text-ink">{email.subject}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{email.body}</p>
      </div>

      {canMutate && active ? (
        <div className="flex flex-wrap gap-2">
          <form
            action={async (formData) => {
              await markTaskContactedWithCommunicationAction(formData);
            }}
          >
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="markWaiting" value="true" />
            <input type="hidden" name="channel" value="email" />
            <input type="hidden" name="draftType" value={draft.draftType} />
            <button type="submit" className={buttonClass("primary", "sm")}>
              Mark Contacted
            </button>
          </form>
          <CopyTextButton
            value={email.body}
            label="Copy Email"
            onCopied={() => void copyChannel("email")}
          />
          <CopyTextButton
            value={draft.sms}
            label="Copy SMS"
            onCopied={() => void copyChannel("sms")}
          />
          <CopyTextButton
            value={draft.phoneScript}
            label="Call Script"
            onCopied={() => void copyChannel("phone")}
          />
          {task.sourceType === "borrower" ? (
            <CopyTextButton
              value={draft.portalBody}
              label="Copy Portal"
              onCopied={() => void copyChannel("portal")}
            />
          ) : null}
        </div>
      ) : null}

      {canMutate && active ? (
        <form
          action={async (formData) => {
            await scheduleFollowUpAction(formData);
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="taskId" value={task.id} />
          <label className="text-xs text-ink-muted">
            Set Follow-Up
            <input
              type="datetime-local"
              name="nextFollowUpAt"
              className="ml-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink"
              required
            />
          </label>
          <button type="submit" className={buttonClass("secondary", "sm")}>
            Set Follow-Up
          </button>
        </form>
      ) : null}

      {history.length > 0 ? (
        <ol className="space-y-2 border-t border-line pt-2">
          {history.slice(0, 6).map((item) => (
            <li key={item.id}>
              <p className="text-xs font-medium text-ink">
                {item.title}
                {item.simulated ? (
                  <span className="ml-2 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                    Simulated
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-muted">
                {item.detail}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
