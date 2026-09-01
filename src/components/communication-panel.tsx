"use client";

import { useState } from "react";
import { AIRewriteControls } from "@/components/ai-rewrite-controls";
import { CopyTextButton } from "@/components/copy-text-button";
import { OverflowMenu } from "@/components/ui/overflow-menu";
import { buttonClass } from "@/components/ui/button";
import type { AIDraftRewriteIntent } from "@/lib/ai/types";
import { communicationAging } from "@/lib/communications/aging";
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
import type {
  CommunicationAttempt,
  CommunicationChannel,
  DraftType,
} from "@/lib/communications/types";
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
  now,
}: {
  task: TaskRow;
  dealContext: DealRequestContext;
  contact: DealContactRow | null;
  clientNeed: string | null;
  attempts: CommunicationAttempt[];
  processorName: string | null;
  canMutate: boolean;
  replacementNeeded?: boolean;
  now: Date;
}) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<CommunicationChannel>("email");
  const [contactError, setContactError] = useState<string | null>(null);
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
  const rewriteIntent = rewriteIntentFromDraft(draft.draftType);
  const active =
    task.status === "open" ||
    task.status === "in_progress" ||
    task.status === "waiting";
  const preview =
    channel === "sms"
      ? { title: "SMS", body: draft.sms }
      : channel === "phone"
        ? { title: "Call script", body: draft.phoneScript }
        : { title: email.subject, body: email.body };

  async function copyChannel(next: CommunicationChannel) {
    const data = new FormData();
    data.set("taskId", task.id);
    data.set("channel", next);
    data.set("draftType", draft.draftType);
    data.set("audience", draft.audience);
    await recordDraftCopiedAction(data);
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={buttonClass("accent", "sm")}
          onClick={() => setOpen((value) => !value)}
        >
          Contact
        </button>
        <p className="text-sm text-ink-muted">{aging.label}</p>
      </div>

      {open ? (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-ink-muted">
            {contact?.name ?? task.contactName ?? "No contact"}
            {contact?.email || task.contactEmail
              ? ` · ${contact?.email ?? task.contactEmail}`
              : ""}
            . Copy only. Nothing is sent from Deal Room.
          </p>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["email", "Email"],
                ["sms", "SMS"],
                ["phone", "Call script"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setChannel(id)}
                className={buttonClass(channel === id ? "secondary" : "ghost", "sm")}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-ink">{preview.title}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">
              {preview.body}
            </p>
          </div>

          {canMutate && active ? (
            <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <form
                action={async (formData) => {
                  setContactError(null);
                  const result =
                    await markTaskContactedWithCommunicationAction(formData);
                  if (result.error) {
                    setContactError(result.error);
                  }
                }}
              >
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="markWaiting" value="true" />
                <input type="hidden" name="channel" value={channel} />
                <input type="hidden" name="draftType" value={draft.draftType} />
                <button type="submit" className={buttonClass("accent", "sm")}>
                  Mark contacted
                </button>
              </form>
              <CopyTextButton
                value={preview.body}
                label="Copy"
                onCopied={() => void copyChannel(channel)}
              />
              <OverflowMenu
                items={[
                  {
                    label: "Mark waiting",
                    onClick: () => {
                      const data = new FormData();
                      data.set("taskId", task.id);
                      void markTaskWaitingWithCadenceAction(data);
                    },
                  },
                  {
                    label: "Response received",
                    onClick: () => {
                      const data = new FormData();
                      data.set("taskId", task.id);
                      void markResponseReceivedAction(data);
                    },
                  },
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
                    label: "SANDBOX — Simulate response",
                    onClick: () => {
                      const data = new FormData();
                      data.set("taskId", task.id);
                      void simulateInboundResponseAction(data);
                    },
                  },
                ]}
              />
            </div>
            {contactError ? (
              <p className="max-w-xl text-[11px] text-danger">{contactError}</p>
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
                Set follow-up
                <input
                  type="datetime-local"
                  name="nextFollowUpAt"
                  className="ml-2 min-h-10 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink"
                  required
                />
              </label>
              <button type="submit" className={buttonClass("ghost", "sm")}>
                Save
              </button>
            </form>
          ) : null}

          {canMutate && active && channel === "email" ? (
            <AIRewriteControls
              dealId={task.dealId}
              taskId={task.id}
              channel="email"
              subject={email.subject}
              body={email.body}
              intent={rewriteIntent}
            />
          ) : null}

          {history.length > 0 ? (
            <ol className="space-y-2 border-t border-line pt-3">
              {history.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <p className="text-sm text-ink">
                    {item.title}
                    {item.simulated ? " · Simulated" : ""}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-ink-muted">
                    {item.detail}
                  </p>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function rewriteIntentFromDraft(draftType: DraftType): AIDraftRewriteIntent {
  if (draftType === "replacement") {
    return "replacement";
  }
  if (
    draftType === "follow_up" ||
    draftType === "second_follow_up" ||
    draftType === "escalation"
  ) {
    return "follow_up";
  }
  return "clarify";
}
