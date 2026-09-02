"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { OverflowMenu } from "@/components/ui/overflow-menu";
import { buttonClass } from "@/components/ui/button";
import {
  markResponseReceivedAction,
  markTaskWaitingWithCadenceAction,
  scheduleFollowUpAction,
} from "@/lib/communications/actions";
import { claimDealAction } from "@/lib/workflow/actions";
import {
  formatFollowUpDisplay,
  followUpPresets,
  parseCustomFollowUpInput,
  staffDatetimeLocalValue,
} from "@/lib/queue-actions/follow-up-presets";
import type { QueueActionPlan } from "@/lib/queue-actions/derive";
import {
  INLINE_SUCCESS_MESSAGES,
  QUEUE_ACTION_ERROR_MESSAGE,
  type InlineSafeAction,
} from "@/lib/queue-actions/matrix";
import { workActionChipClass } from "@/lib/ui/queue-card";

type PendingState = "idle" | "saving" | "done" | "error";

export function QueueActionBar({
  plan,
  actionLabel,
  href,
}: {
  plan: QueueActionPlan;
  actionLabel: string;
  href: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingState>("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const liveRef = useRef<HTMLSpanElement>(null);

  const announce = useCallback((message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 3200);
  }, []);

  const runAction = useCallback(
    async (key: InlineSafeAction, extra?: Record<string, string>) => {
      if (pending === "saving") {
        return;
      }
      setPending("saving");
      const form = new FormData();
      if (key === "claim_file") {
        form.set("dealId", plan.dealId);
      } else if (plan.taskId) {
        form.set("taskId", plan.taskId);
      } else {
        setPending("error");
        announce(QUEUE_ACTION_ERROR_MESSAGE);
        return;
      }
      for (const [name, value] of Object.entries(extra ?? {})) {
        form.set(name, value);
      }

      let result: { error: string | null };
      switch (key) {
        case "claim_file":
          result = await claimDealAction(form);
          break;
        case "mark_waiting":
          result = await markTaskWaitingWithCadenceAction(form);
          break;
        case "set_follow_up":
          result = await scheduleFollowUpAction(form);
          break;
        case "response_received":
          result = await markResponseReceivedAction(form);
          break;
      }

      if (result.error) {
        setPending("error");
        announce(QUEUE_ACTION_ERROR_MESSAGE);
        return;
      }

      setPending("done");
      const success =
        key === "set_follow_up" && extra?.nextFollowUpAt
          ? `Follow-up set for ${formatFollowUpDisplay(extra.nextFollowUpAt)}`
          : INLINE_SUCCESS_MESSAGES[key];
      announce(success);
      router.refresh();
      window.setTimeout(() => setPending("idle"), 400);
    },
    [announce, pending, plan.dealId, plan.taskId, router],
  );

  const disabled = pending === "saving" || !plan.canMutate;

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {plan.primaryInline ? (
          <button
            type="button"
            disabled={disabled}
            className={workActionChipClass("Claim file")}
            onClick={() => void runAction("claim_file")}
          >
            {pending === "saving" ? "Saving…" : "Claim file →"}
          </button>
        ) : (
          <Link
            href={href}
            className={`${workActionChipClass(actionLabel)} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-teal/40`}
          >
            {actionLabel} →
          </Link>
        )}
        {plan.secondary.length > 0 ? (
          <OverflowMenu
            label="•••"
            items={plan.secondary.map((item) => ({
              label: item.label,
              onClick: () => {
                if (item.key === "set_follow_up") {
                  setFollowUpOpen(true);
                  return;
                }
                void runAction(item.key);
              },
            }))}
          />
        ) : null}
      </div>

      {followUpOpen && plan.taskId ? (
        <FollowUpPicker
          taskId={plan.taskId}
          disabled={disabled}
          onClose={() => setFollowUpOpen(false)}
          onSave={async (iso) => {
            await runAction("set_follow_up", { nextFollowUpAt: iso });
            setFollowUpOpen(false);
          }}
        />
      ) : null}

      <span ref={liveRef} className="sr-only" aria-live="polite">
        {feedback}
      </span>
      {feedback ? (
        <p className="absolute bottom-1 right-3 text-[11px] text-success">{feedback}</p>
      ) : null}
    </>
  );
}

function FollowUpPicker({
  taskId,
  disabled,
  onClose,
  onSave,
}: {
  taskId: string;
  disabled: boolean;
  onClose: () => void;
  onSave: (iso: string) => Promise<void>;
  }) {
  const presets = followUpPresets();
  const [custom, setCustom] = useState(staffDatetimeLocalValue(presets[0]!.iso));
  const [saving, setSaving] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Set follow-up"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[16px] border border-line bg-surface p-4 shadow-[var(--shadow-float)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-ink">Set follow-up</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Times shown in America/Los_Angeles staff clock.
        </p>
        <input type="hidden" name="taskId" value={taskId} />
        <ul className="mt-3 space-y-2">
          {presets.map((preset) => (
            <li key={preset.key}>
              <button
                type="button"
                disabled={disabled || saving}
                className={`${buttonClass("secondary", "sm")} w-full justify-between`}
                onClick={async () => {
                  setSaving(true);
                  await onSave(preset.iso);
                  setSaving(false);
                }}
              >
                <span>{preset.label}</span>
                <span className="text-ink-muted">{preset.displayDate}</span>
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 space-y-2 border-t border-line pt-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const iso = parseCustomFollowUpInput(custom);
            if (!iso) {
              return;
            }
            setSaving(true);
            await onSave(iso);
            setSaving(false);
          }}
        >
          <label className="block text-xs text-ink-muted">
            Custom
            <input
              type="datetime-local"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink"
            />
          </label>
          <p className="text-[11px] text-ink-muted">
            Saves as{" "}
            {parseCustomFollowUpInput(custom)
              ? formatFollowUpDisplay(parseCustomFollowUpInput(custom)!)
              : "—"}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass("ghost", "sm")} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={disabled || saving} className={buttonClass("accent", "sm")}>
              {saving ? "Saving…" : "Save follow-up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
