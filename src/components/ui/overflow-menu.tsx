"use client";

import { useEffect, useRef, useState } from "react";

export function OverflowMenu({
  items,
}: {
  items: { label: string; onClick: () => void; tone?: "default" | "danger" }[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface text-ink hover:bg-surface-muted"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <span className="sr-only">More actions</span>
        <span aria-hidden className="text-base leading-none">
          ⋯
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-44 rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-card)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium ${
                item.tone === "danger"
                  ? "text-danger hover:bg-danger-soft"
                  : "text-ink hover:bg-surface-muted"
              }`}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
