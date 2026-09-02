"use client";

import { useState } from "react";
import type { MorningBriefResult } from "@/lib/command-center/derive";

export function MorningBriefPanel({ brief }: { brief: MorningBriefResult }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="border-y border-line py-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Morning brief
        </span>
        <span className="text-[11px] text-ink-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-2">
          <p className="whitespace-pre-line text-sm leading-6 text-ink">
            {brief.text}
          </p>
          <p className="text-xs leading-5 text-ink-muted">{brief.disclaimer}</p>
        </div>
      ) : null}
    </section>
  );
}
