"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button";

export function CopyTextButton({
  value,
  label,
  onCopied,
}: {
  value: string;
  label: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!value) {
    return null;
  }
  return (
    <button
      type="button"
      className={buttonClass("ghost", "sm")}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        onCopied?.();
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}
