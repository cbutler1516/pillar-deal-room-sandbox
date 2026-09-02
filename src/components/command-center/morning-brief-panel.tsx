"use client";

import { useState } from "react";
import type { MorningBriefResult } from "@/lib/command-center/derive";
import { surfaceClass } from "@/components/ui/styles";

export function MorningBriefPanel({ brief }: { brief: MorningBriefResult }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`${surfaceClass("card")} px-4 py-3`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-sm font-medium text-ink">AI-assisted morning brief</span>
        <span className="text-xs text-ink-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <p className="whitespace-pre-line text-sm leading-6 text-ink">
            {brief.text}
          </p>
          <p className="text-xs leading-5 text-ink-muted">{brief.disclaimer}</p>
        </div>
      ) : null}
    </section>
  );
}
