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
  const staffNameSet = useMemo(
    () => new Set(Object.values(staffNames).filter(Boolean)),
    [staffNames],
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
            <h3 className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
              {day.label}
            </h3>
            <ol className="relative space-y-2 border-l-2 border-line/80 pl-6">
              {day.entries.map((entry) => {
                const open = openId === entry.id;
                const system = entry.actor === "System";
                const actorName = entry.actor.split("→")[0]?.trim() ?? entry.actor;
                const isStaff = staffNameSet.has(actorName);
                return (
                  <li key={entry.id} className="relative">
                    <span
                      aria-hidden
                      className={`absolute top-4 -left-[29px] h-2.5 w-2.5 rounded-full border ${
                        system
                          ? "border-line bg-surface-muted"
                          : "border-pillar-teal/40 bg-pillar-teal-soft"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setOpenId(open || !entry.detail ? null : entry.id)
                      }
                      className={`flex w-full items-start gap-3 rounded-[10px] px-3 py-2.5 text-left transition duration-200 motion-reduce:transition-none ${
                        system
                          ? "hover:bg-surface-muted/60"
                          : "border border-transparent hover:bg-stone"
                      }`}
                    >
                      <StaffAvatar
                        name={system ? "System" : actorName}
                        size={32}
                        label={entry.actor}
                        kind={isStaff ? "staff" : "external"}
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
