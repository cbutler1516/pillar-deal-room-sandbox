"use client";

import { useState } from "react";
import { DEMO_GUIDE_STEPS } from "@/lib/demo/guide";
import { buttonClass } from "@/components/ui/button";
import { surfaceClass } from "@/components/ui/styles";

export function DemoGuide({
  caseyHref,
  readyHref,
  portalHref,
}: {
  caseyHref: string;
  readyHref: string;
  portalHref: string;
}) {
  const [open, setOpen] = useState(false);
  const hrefs = [
    "/dashboard",
    caseyHref,
    `${caseyHref.includes("?") ? caseyHref : `${caseyHref}?tab=documents`}`,
    caseyHref.includes("?")
      ? caseyHref.replace(/tab=[^&]+/, "tab=conditions")
      : `${caseyHref}?tab=conditions`,
    "/team",
    portalHref,
    readyHref,
  ];

  return (
    <div className="relative">
      <button
        type="button"
        className={buttonClass("secondary", "sm")}
        aria-expanded={open}
        aria-controls="demo-guide-panel"
        onClick={() => setOpen((value) => !value)}
      >
        Demo guide
      </button>
      {open ? (
        <div
          id="demo-guide-panel"
          className={`${surfaceClass("floating")} absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] px-4 py-3`}
        >
          <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
            Sandbox demo
          </p>
          <ol className="mt-3 space-y-3">
            {DEMO_GUIDE_STEPS.map((step, index) => (
              <li key={step.title}>
                <p className="text-xs font-semibold text-ink">
                  Step {index + 1}. {step.title}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-ink-muted">{step.body}</p>
                <a
                  href={hrefs[index]}
                  className="mt-1 inline-block text-xs font-medium text-pillar-teal underline-offset-2 hover:underline"
                >
                  Open {step.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
