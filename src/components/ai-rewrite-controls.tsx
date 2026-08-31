"use client";

import { useState, useTransition } from "react";
import { CopyTextButton } from "@/components/copy-text-button";
import { buttonClass } from "@/components/ui/button";
import { rewriteCommunicationDraftAction } from "@/lib/ai/actions";
import {
  AI_ASSIST_DISCLAIMER,
  type AIDraftRewriteIntent,
  type AIDraftRewriteResult,
  type AIRewriteChannel,
} from "@/lib/ai/types";

export function AIRewriteControls({
  dealId,
  taskId,
  channel,
  subject,
  body,
  intent,
}: {
  dealId: string;
  taskId: string;
  channel: AIRewriteChannel;
  subject: string | null;
  body: string;
  intent: AIDraftRewriteIntent;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<AIDraftRewriteResult | null>(null);

  function suggestRewrite() {
    startTransition(async () => {
      const data = new FormData();
      data.set("dealId", dealId);
      data.set("taskId", taskId);
      data.set("channel", channel);
      data.set("subject", subject ?? "");
      data.set("body", body);
      data.set("intent", intent);
      const response = await rewriteCommunicationDraftAction(data);
      if (response.error || !response.result) {
        setSuggestion(null);
        setError(response.error ?? "Unable to suggest a rewrite.");
        return;
      }
      setError(null);
      setSuggestion(response.result);
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className={buttonClass("secondary", "sm")}
        disabled={pending}
        aria-busy={pending}
        onClick={suggestRewrite}
      >
        {pending ? "Suggesting…" : "Suggest rewrite"}
      </button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {suggestion ? (
        <div className="rounded-lg border border-line bg-surface-muted/50 px-3 py-2">
          <p className="text-xs font-semibold text-ink">{suggestion.subject}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
            {suggestion.body}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyTextButton value={suggestion.body} label="Copy suggestion" />
          </div>
          <p className="mt-2 text-[11px] text-ink-muted">
            {suggestion.disclaimer || AI_ASSIST_DISCLAIMER}
          </p>
        </div>
      ) : null}
    </div>
  );
}
