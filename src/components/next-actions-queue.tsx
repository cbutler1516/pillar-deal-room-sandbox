import Link from "next/link";
import { StaffAvatar } from "@/components/ui/staff-avatar";
import { CardHeader } from "@/components/ui/surface-card";
import { surfaceClass } from "@/components/ui/styles";
import { formatFollowUpAt } from "@/lib/format";
import {
  QUEUE_ACCENT_EDGE,
  QUEUE_SECTION_WASH,
  queueCardAccent,
  queueContextLine,
  queueWorkCardLabel,
  type QueueCardAccent,
} from "@/lib/ui/queue-card";
import type { QueueTodaySection } from "@/lib/ops/operational-work";

export type QueueDisplayRow = {
  id: string;
  dealId: string;
  borrowerName: string;
  entityName?: string | null;
  loanType?: string | null;
  location?: string | null;
  title: string;
  reason: string;
  actionLabel: string;
  href: string;
  hot?: boolean;
  assignedProcessorId?: string | null;
  queueSection?: QueueTodaySection | string | null;
  dueAt?: string | null;
};

export function NextActionsQueue({
  rows,
  staffNames = {},
  title = "Next Actions",
  description,
  empty = "Nothing needs your attention.",
  compact = false,
  accent,
}: {
  rows: QueueDisplayRow[];
  staffNames?: Record<string, string>;
  title?: string;
  description?: string;
  empty?: string;
  compact?: boolean;
  accent?: QueueCardAccent;
}) {
  const tone = accent ?? (rows[0] ? queueCardAccent(rows[0].queueSection) : undefined);
  return (
    <section>
      <div className={tone ? `-mx-1 mb-0.5 rounded-[10px] px-2 pt-1.5 ${QUEUE_SECTION_WASH[tone]}` : ""}>
      <CardHeader
        title={title}
        description={description}
        meta={rows.length}
        accent={tone}
        compact={compact}
      />
      </div>
      {rows.length === 0 ? (
        <p className="text-sm leading-6 text-ink-muted">{empty}</p>
      ) : (
        <ul className={compact ? "space-y-1.5" : "space-y-2"}>
          {rows.map((row) => {
            const owner = row.assignedProcessorId
              ? staffNames[row.assignedProcessorId] ?? null
              : null;
            const accent = queueCardAccent(row.queueSection);
            const context = queueContextLine({
              loanType: row.loanType,
              location: row.location,
            });
            const due =
              row.dueAt && !row.reason.toLowerCase().includes("due")
                ? formatFollowUpAt(row.dueAt)
                : null;
            const reason = `${row.reason}${due ? ` · ${due}` : ""}`;
            return (
              <li key={row.id}>
                <article>
                  <Link
                    href={row.href}
                    aria-label={queueWorkCardLabel({
                      borrowerName: row.borrowerName,
                      title: row.title,
                      reason,
                      actionLabel: row.actionLabel,
                      ownerName: owner,
                    })}
                    className={`${surfaceClass("card", true)} block border-l-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-navy/30 ${QUEUE_ACCENT_EDGE[accent]} ${
                      compact ? "px-3 py-2" : "px-3.5 py-2.5"
                    }`}
                  >
                    <div
                      aria-hidden
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold leading-4 tracking-[0.04em] text-ink uppercase">
                          {row.borrowerName}
                          {context ? (
                            <span className="ml-1.5 font-medium tracking-normal text-ink-muted normal-case">
                              · {context}
                            </span>
                          ) : row.entityName &&
                            row.entityName.trim() &&
                            row.entityName !== row.borrowerName ? (
                            <span className="ml-1.5 font-medium tracking-normal text-ink-muted normal-case">
                              · {row.entityName}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-sm leading-5 text-ink">
                          {row.title}
                          <span
                            className={`font-normal ${
                              row.hot ? "text-warning" : "text-ink-muted"
                            }`}
                          >
                            {` · ${reason}`}
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StaffAvatar name={owner} unassigned={!owner} size={24} />
                        <span className="text-xs font-medium leading-4 text-pillar-teal">
                          {row.actionLabel} →
                        </span>
                      </div>
                    </div>
                  </Link>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
