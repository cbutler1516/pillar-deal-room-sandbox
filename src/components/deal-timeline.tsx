"use client";

import { useMemo, useState } from "react";
import { FilterToggle } from "@/components/ui/controls";
import { StaffAvatar } from "@/components/ui/staff-avatar";
import type { CommunicationAttempt } from "@/lib/communications/types";
import type { ActivityRow, DealContactRow } from "@/lib/data/deals";
import { parseStaffInstant } from "@/lib/format";
import { formatActivityClock } from "@/lib/ops/activity-display";
import {
  buildDealTimeline,
  filterTimelineEntries,
  groupTimelineByDay,
  type TimelineFilter,
} from "@/lib/ops/timeline";

const FILTERS: { id: TimelineFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "documents", label: "Documents" },
  { id: "communications", label: "Communications" },
  { id: "workflow", label: "Workflow" },
];

export function DealTimeline({
  activity,
  attempts,
  contacts = [],
  staffNames = {},
  nowMs,
}: {
  activity: ActivityRow[];
  attempts: CommunicationAttempt[];
  contacts?: DealContactRow[];
  staffNames?: Record<string, string>;
  nowMs: number;
}) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const now = useMemo(() => parseStaffInstant(nowMs), [nowMs]);
  const entries = useMemo(
    () =>
      now
        ? filterTimelineEntries(
            buildDealTimeline({ activity, attempts, contacts, staffNames, now }),
            filter,
          )
        : [],
    [activity, attempts, contacts, staffNames, filter, now],
  );
  const days = useMemo(
    () => (now ? groupTimelineByDay(entries, now) : []),
    [entries, now],
  );

  if (!now) {
    return (
      <p className="text-sm leading-6 text-ink-muted">
        Timeline could not determine the staff clock.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <FilterToggle
            key={item.id}
            active={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </FilterToggle>
        ))}
      </div>
      {days.length === 0 ? (
        <p className="text-sm leading-6 text-ink-muted">
          No history on this file yet.
        </p>
      ) : (
        days.map((day) => (
          <section key={day.key}>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
              {day.label}
            </h3>
            <ol className="relative space-y-1 border-l border-line pl-5">
              {day.entries.map((entry) => {
                const open = openId === entry.id;
                const system = entry.actor === "System";
                return (
                  <li key={entry.id} className="relative">
                    <span
                      aria-hidden
                      className="absolute top-4 -left-[23px] h-2 w-2 rounded-full border border-line bg-surface"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setOpenId(open || !entry.detail ? null : entry.id)
                      }
                      className="flex w-full items-start gap-3 rounded-[14px] px-2 py-2.5 text-left transition duration-200 hover:bg-surface-muted/70 motion-reduce:transition-none"
                    >
                      <StaffAvatar
                        name={entry.actor.split("→")[0]?.trim() ?? entry.actor}
                        size={28}
                        label={entry.actor}
                      />
                      <time className="w-16 shrink-0 pt-1 text-xs tabular-nums text-ink-muted">
                        {formatActivityClock(entry.at, now)}
                      </time>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${system ? "text-ink-muted" : "text-ink"}`}>
                          {entry.actor}
                        </p>
                        <p className="mt-0.5 text-sm leading-6 text-ink-muted">
                          {entry.action}
                          {entry.target ? ` · ${entry.target}` : ""}
                          {entry.simulated ? " · Simulated" : ""}
                        </p>
                        {entry.context ? (
                          <p className="mt-0.5 text-xs leading-5 text-ink-muted">
                            {entry.context}
                          </p>
                        ) : null}
                      </div>
                    </button>
                    {open && entry.detail ? (
                      <p className="ml-24 pb-3 text-sm leading-6 text-ink-muted">
                        {entry.detail}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
