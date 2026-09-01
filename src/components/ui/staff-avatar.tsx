"use client";

import { useState } from "react";
import {
  STAFF_AVATAR_TONES,
  sandboxStaffAvatarUrl,
  staffAvatarToneIndex,
  staffInitials,
  type StaffAvatarSize,
} from "@/lib/ui/staff-identity";

const SIZE_CLASS: Record<StaffAvatarSize, string> = {
  24: "h-6 w-6 text-[10px]",
  28: "h-7 w-7 text-[11px]",
  32: "h-8 w-8 text-xs",
  40: "h-10 w-10 text-sm",
  48: "h-12 w-12 text-base",
};

export function StaffAvatar({
  name,
  avatarUrl,
  size = 32,
  unassigned = false,
  label,
  kind = "staff",
}: {
  name?: string | null;
  avatarUrl?: string | null;
  size?: StaffAvatarSize;
  unassigned?: boolean;
  label?: string;
  kind?: "staff" | "external";
}) {
  const display = (name ?? "").trim();
  const title = label ?? (unassigned ? "Unassigned" : display || "Staff");
  const resolved =
    kind === "staff" ? (avatarUrl ?? sandboxStaffAvatarUrl(display)) : null;
  const [failed, setFailed] = useState(false);
  const frame = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold tracking-tight ${SIZE_CLASS[size]}`;

  if (unassigned || !display) {
    return (
      <span
        className={`${frame} border border-dashed border-line bg-surface-muted text-ink-muted`}
        title={title}
        aria-label={title}
      >
        <UnassignedMark />
      </span>
    );
  }

  if (resolved && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved}
        alt={title}
        title={title}
        onError={() => setFailed(true)}
        className={`${frame} object-cover ring-2 ring-pillar-teal/45 ring-offset-1 ring-offset-workspace`}
      />
    );
  }

  const tone =
    kind === "external"
      ? { bg: "bg-surface-muted", fg: "text-pillar-navy" }
      : STAFF_AVATAR_TONES[staffAvatarToneIndex(display)];
  return (
    <span
      className={`${frame} ${tone.bg} ${tone.fg}`}
      title={title}
      aria-label={title}
    >
      {staffInitials(display)}
    </span>
  );
}

export function StaffPresence({
  name,
  avatarUrl,
  size = 28,
  unassigned = false,
  label,
  kind = "staff",
}: {
  name?: string | null;
  avatarUrl?: string | null;
  size?: StaffAvatarSize;
  unassigned?: boolean;
  label?: string;
  kind?: "staff" | "external";
}) {
  const copy = unassigned || !name?.trim() ? "Unassigned" : (label ?? name);
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <StaffAvatar
        name={name}
        avatarUrl={avatarUrl}
        size={size}
        unassigned={unassigned || !name?.trim()}
        label={copy}
        kind={kind}
      />
      <span className="truncate text-xs text-ink-muted">{copy}</span>
    </span>
  );
}

function UnassignedMark() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
      <path
        d="M6 2v8M2 6h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
