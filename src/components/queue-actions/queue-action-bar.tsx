"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { OverflowMenu } from "@/components/ui/overflow-menu";
import { buttonClass } from "@/components/ui/button";
import {
  markResponseReceivedAction,
  markTaskWaitingWithCadenceAction,
  scheduleFollowUpAction,
} from "@/lib/communications/actions";
import { claimDealAction } from "@/lib/workflow/actions";
import type { QueueActionPlan } from "@/lib/queue-actions/derive";
import {
  followUpPresets,
  parseCustomFollowUpInput,
  staffDatetimeLocalValue,
} from "@/lib/queue-actions/follow-up-presets";
import {
  feedbackForQueueAction,
  type InlineSafeAction,
} from "@/lib/queue-actions/matrix";
import { workActionChipClass } from "@/lib/ui/queue-card";

type Tone = "success" | "error" | null;

export function QueueActionBar({ plan }: { plan: QueueActionPlan }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [tone, setTone] = useState<Tone>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const inFlight = useRef(false);

  const runAction = useCallback(
    async (key: InlineSafeAction, extra?: Record<string, string>) => {
      if (inFlight.current) {
        return false;
      }
      inFlight.current = true;
      setSaving(true);
      setTone(null);
      setFeedback(null);

      const form = new FormData();
      if (key === "claim_file") {
        form.set("dealId", plan.dealId);
      } else if (plan.taskId) {
        form.set("taskId", plan.taskId);
      } else {
        const failed = feedbackForQueueAction({ error: "missing" }, key);
        setTone(failed.tone);
        setFeedback(failed.message);
        setSaving(false);
        inFlight.current = false;
        return false;
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

      const next = feedbackForQueueAction(result, key);
      setTone(next.tone);
      setFeedback(next.message);
      setSaving(false);
      inFlight.current = false;
      if (next.tone === "error") {
        return false;
      }
      router.refresh();
      return true;
    },
    [plan.dealId, plan.taskId, router],
  );

  const closeFollowUp = useCallback(() => setFollowUpOpen(false), []);

  const startAction = useCallback(
    (key: InlineSafeAction) => {
      if (key === "set_follow_up") {
        setFollowUpOpen(true);
        return;
      }
      void runAction(key);
    },
    [runAction],
  );

  const overflowItems = plan.overflow.map((item) => ({
    label: item.label,
    onClick: () => startAction(item.key),
  }));

  const primary = plan.primary;
  const primaryKey = primary.kind === "inline" ? primary.key : null;
  const disabled = saving || (primary.kind === "inline" && !plan.canMutate);

  return (
    <div className="relative flex min-w-0 shrink-0 flex-col items-end gap-0.5">
      <div className="flex items-center justify-end gap-1">
        {primary.kind === "inline" && primaryKey ? (
          <button
            type="button"
            disabled={disabled}
            aria-busy={saving}
            aria-haspopup={primaryKey === "set_follow_up" ? "dialog" : undefined}
            aria-expanded={primaryKey === "set_follow_up" ? followUpOpen : undefined}
            className={`${workActionChipClass(primary.label)} min-h-8 rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-teal/40 disabled:opacity-60`}
            onClick={() => startAction(primaryKey)}
          >
            {saving ? "Saving" : primary.label}
          </button>
        ) : primary.kind === "navigate" ? (
          <Link
            href={primary.href}
            className={`${workActionChipClass(primary.label)} min-h-8 rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-teal/40`}
          >
            {primary.label} →
          </Link>
        ) : null}
        {overflowItems.length > 0 ? (
          <OverflowMenu label="•••" ariaLabel="More actions" items={overflowItems} />
        ) : null}
      </div>
      {followUpOpen && plan.taskId ? (
        <FollowUpPicker
          disabled={saving}
          onClose={closeFollowUp}
          onSave={async (iso) => {
            const ok = await runAction("set_follow_up", { nextFollowUpAt: iso });
            if (ok) {
              setFollowUpOpen(false);
            }
          }}
        />
      ) : null}
      {feedback ? (
        <p
          role={tone === "error" ? "alert" : "status"}
          className={`max-w-[11rem] text-right text-[11px] leading-4 ${
            tone === "error" ? "text-danger" : "text-ink-muted"
          }`}
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

function FollowUpPicker({
  disabled,
  onClose,
  onSave,
}: {
  disabled: boolean;
  onClose: () => void;
  onSave: (iso: string) => Promise<void>;
}) {
  const presets = followUpPresets();
  const headingId = useId();
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState(staffDatetimeLocalValue(presets[0]!.iso));
  const [saving, setSaving] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = dialogRef.current?.querySelector("button");
    if (first instanceof HTMLButtonElement) {
      first.focus();
    }
    function onPointer(event: MouseEvent) {
      if (!dialogRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function saveIso(iso: string) {
    setSaving(true);
    setCustomError(null);
    await onSave(iso);
    setSaving(false);
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      className="absolute right-0 top-full z-30 mt-1 w-56 rounded-[10px] border border-line bg-surface p-2 shadow-[var(--shadow-float)]"
    >
      <p id={headingId} className="px-1.5 pb-0.5 text-[11px] font-semibold text-ink">
        Set Follow-Up
      </p>
      <p className="px-1.5 pb-1 text-[11px] text-ink-muted">Pacific time</p>
      <ul className="space-y-0.5">
        {presets.map((preset) => (
          <li key={preset.key}>
            <button
              type="button"
              disabled={disabled || saving}
              className="flex w-full items-center justify-between rounded-md px-1.5 py-1.5 text-left text-xs font-medium text-ink hover:bg-stone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-teal/40 disabled:opacity-60"
              onClick={() => void saveIso(preset.iso)}
            >
              <span>{preset.label}</span>
              <span className="text-[11px] font-normal text-ink-muted">{preset.displayDate}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-1 border-t border-line pt-1">
        {customOpen ? (
          <form
            className="space-y-1.5 px-1 pt-1"
            onSubmit={(event) => {
              event.preventDefault();
              const iso = parseCustomFollowUpInput(custom);
              if (!iso) {
                setCustomError("Choose a future time.");
                return;
              }
              void saveIso(iso);
            }}
          >
            <label className="block text-[11px] text-ink-muted" htmlFor={`${headingId}-date`}>
              Date and time
            </label>
            <input
              id={`${headingId}-date`}
              type="datetime-local"
              value={custom}
              onChange={(event) => {
                setCustom(event.target.value);
                setCustomError(null);
              }}
              className="w-full rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-teal/40"
            />
            {customError ? (
              <p role="alert" className="text-[11px] text-danger">
                {customError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={disabled || saving}
              className={buttonClass("primary", "sm", "w-full")}
            >
              Save
            </button>
          </form>
        ) : (
          <button
            type="button"
            disabled={disabled || saving}
            className="flex w-full rounded-md px-1.5 py-1.5 text-left text-xs font-medium text-ink hover:bg-stone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-teal/40"
            onClick={() => setCustomOpen(true)}
          >
            Choose Date
          </button>
        )}
      </div>
    </div>
  );
}
