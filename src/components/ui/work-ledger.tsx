import Link from "next/link";
import { SectionHeader } from "@/components/ui/surface-card";
import {
  QUEUE_ACCENT_EDGE,
  queueCardAccent,
  queueWorkCardLabel,
  workActionChipClass,
} from "@/lib/ui/queue-card";
import type { QueueTodaySection } from "@/lib/ops/operational-work";

export type WorkLedgerRow = {
  id: string;
  borrowerName: string;
  context?: string | null;
  title: string;
  reason?: string | null;
  actionLabel: string;
  href: string;
  hot?: boolean;
  ownerName?: string | null;
  timing?: string | null;
  queueSection?: QueueTodaySection | string | null;
};

/**
 * Dense operational ledger. Default presentation for task/work collections
 * that must stay scannable at hundreds of rows.
 */
export function WorkLedger({
  rows,
  title,
  description,
  empty = "You're caught up here.",
}: {
  rows: WorkLedgerRow[];
  title?: string;
  description?: string;
  empty?: string;
}) {
  return (
    <section>
      {title ? (
        <SectionHeader title={title} meta={rows.length} />
      ) : null}
      {description ? (
        <p className="mb-3 text-xs text-ink-muted">{description}</p>
      ) : null}
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {rows.map((row) => {
            const accent = queueCardAccent(row.queueSection);
            return (
              <li key={row.id}>
                <Link
                  href={row.href}
                  aria-label={queueWorkCardLabel({
                    borrowerName: row.borrowerName,
                    title: row.title,
                    reason: row.reason ?? "",
                    actionLabel: row.actionLabel,
                    ownerName: row.ownerName,
                  })}
                  className={`flex items-center gap-3 border-l-2 px-3 py-2 transition hover:bg-stone/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-teal/40 ${
                    row.queueSection
                      ? QUEUE_ACCENT_EDGE[accent]
                      : "border-l-transparent"
                  }`}
                >
                  <span aria-hidden className="contents">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="truncate text-[13px] font-semibold text-ink">
                          {row.borrowerName}
                        </span>
                        {row.context ? (
                          <span className="truncate text-[11px] text-ink-muted">
                            {row.context}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                        <span className="truncate text-[13px] text-ink">{row.title}</span>
                        {row.reason ? (
                          <span
                            className={`truncate text-[11px] ${
                              row.hot ? "text-warning" : "text-ink-muted"
                            }`}
                          >
                            {row.reason}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {row.ownerName ? (
                      <span className="hidden min-w-24 shrink-0 truncate text-[11px] text-ink-muted sm:block">
                        {row.ownerName}
                      </span>
                    ) : null}
                    {row.timing ? (
                      <span className="hidden shrink-0 text-[11px] tabular-nums text-ink-muted sm:block">
                        {row.timing}
                      </span>
                    ) : null}
                    <span className={workActionChipClass(row.actionLabel)}>
                      {row.actionLabel} →
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
