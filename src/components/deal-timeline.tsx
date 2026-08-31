"use client";

import { useMemo, useState } from "react";
import { FilterToggle } from "@/components/ui/controls";
import type { CommunicationAttempt } from "@/lib/communications/types";
import type { ActivityRow, DealContactRow } from "@/lib/data/deals";
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
}: {
  activity: ActivityRow[];
  attempts: CommunicationAttempt[];
  contacts?: DealContactRow[];
  staffNames?: Record<string, string>;
}) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);
  const entries = useMemo(
    () =>
      filterTimelineEntries(
        buildDealTimeline({ activity, attempts, contacts, staffNames, now }),
        filter,
      ),
    [activity, attempts, contacts, staffNames, filter, now],
  );
  const days = useMemo(() => groupTimelineByDay(entries, now), [entries, now]);

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
            <ol className="divide-y divide-line border-y border-line">
              {day.entries.map((entry) => {
                const open = openId === entry.id;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenId(open || !entry.detail ? null : entry.id)
                      }
                      className="flex w-full items-start justify-between gap-4 py-3.5 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{entry.actor}</p>
                        {entry.context ? (
                          <p className="mt-0.5 text-xs leading-5 text-ink-muted">
                            {entry.context}
                          </p>
                        ) : null}
                        <p className="mt-1 text-sm leading-6 text-ink">
                          {entry.action}
                          {entry.target ? ` · ${entry.target}` : ""}
                          {entry.simulated ? " · Simulated" : ""}
                        </p>
                      </div>
                      <time className="shrink-0 text-xs text-ink-muted">
                        {formatActivityClock(entry.at, now)}
                      </time>
                    </button>
                    {open && entry.detail ? (
                      <p className="pb-3.5 text-sm leading-6 text-ink-muted">
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
