import Link from "next/link";
import { StaffPresence } from "@/components/ui/staff-avatar";
import { CardHeader } from "@/components/ui/surface-card";
import { surfaceClass } from "@/components/ui/styles";
import { formatFollowUpAt } from "@/lib/format";
import {
  QUEUE_ACCENT_EDGE,
  queueCardAccent,
  queueContextLine,
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
}: {
  rows: QueueDisplayRow[];
  staffNames?: Record<string, string>;
  title?: string;
  description?: string;
  empty?: string;
  compact?: boolean;
}) {
  return (
    <section>
      <CardHeader title={title} description={description} meta={rows.length} />
      {rows.length === 0 ? (
        <p className="text-sm leading-6 text-ink-muted">{empty}</p>
      ) : (
        <ul className={compact ? "space-y-2" : "space-y-2.5"}>
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
            return (
              <li key={row.id}>
                <article
                  className={`${surfaceClass("card", true)} border-l-2 ${QUEUE_ACCENT_EDGE[accent]} ${
                    compact ? "px-3.5 py-2.5" : "px-4 py-3"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link href={row.href} className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold tracking-[0.04em] text-ink uppercase">
                        {row.borrowerName}
                      </p>
                      {row.entityName &&
                      row.entityName.trim() &&
                      row.entityName !== row.borrowerName ? (
                        <p className="mt-0.5 truncate text-[11px] leading-4 text-ink-muted">
                          {row.entityName}
                        </p>
                      ) : null}
                      {context ? (
                        <p className="mt-0.5 text-[11px] leading-4 text-ink-muted">
                          {context}
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-sm leading-5 text-ink">{row.title}</p>
                      <p
                        className={`mt-0.5 text-xs leading-5 ${
                          row.hot ? "text-warning" : "text-ink-muted"
                        }`}
                      >
                        {row.reason}
                        {due ? ` · ${due}` : ""}
                      </p>
                    </Link>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <StaffPresence name={owner} unassigned={!owner} size={24} />
                      {compact ? null : (
                        <Link
                          href={row.href}
                          className="text-xs font-medium text-pillar-teal hover:text-pillar-navy"
                        >
                          {row.actionLabel} →
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
