"use client";

import { useState } from "react";
import { btnCompactClass } from "@/components/ui/styles";

export function CopyTextButton({
  value,
  label,
}: {
  value: string;
  label: string;
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
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
