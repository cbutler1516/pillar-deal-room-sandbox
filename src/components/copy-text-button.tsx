"use client";

import { useState } from "react";
import { btnCompactClass } from "@/components/ui/styles";

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
      className={btnCompactClass}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        onCopied?.();
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
