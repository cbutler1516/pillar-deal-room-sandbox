import Link from "next/link";
import { CardHeader } from "@/components/ui/surface-card";
import { formatFollowUpAt } from "@/lib/format";
import {
  QUEUE_ACCENT_EDGE,
  queueCardAccent,
  queueCardBody,
  queueContextLine,
  queueWorkCardLabel,
  workActionChipClass,
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
}: {
  rows: QueueDisplayRow[];
  staffNames?: Record<string, string>;
  title?: string;
  description?: string;
  empty?: string;
  compact?: boolean;
  accent?: QueueCardAccent;
  layout?: "list" | "grid";
}) {
  return (
    <section>
      <CardHeader
        title={title}
        description={description}
        meta={rows.length}
        compact={compact}
      />
      {rows.length === 0 ? (
        <p className="py-4 text-sm leading-6 text-ink-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {rows.map((row) => {
            const owner = row.assignedProcessorId
              ? staffNames[row.assignedProcessorId] ?? null
              : null;
            return (
              <li key={row.id}>
                <WorkRow row={row} owner={owner} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function WorkRow({ row, owner }: { row: QueueDisplayRow; owner: string | null }) {
  const accent = queueCardAccent(row.queueSection);
  const context =
    queueContextLine({ loanType: row.loanType, location: row.location }) ??
    (row.entityName && row.entityName.trim() && row.entityName !== row.borrowerName
      ? row.entityName
      : null);
  const due =
    row.dueAt && !row.reason.toLowerCase().includes("due")
      ? formatFollowUpAt(row.dueAt)
      : null;
  const body = queueCardBody({
    title: row.title,
    reason: `${row.reason}${due ? ` · ${due}` : ""}`,
    loanType: row.loanType,
    queueSection: row.queueSection,
    assigned: Boolean(owner),
    actionLabel: row.actionLabel,
  });

  return (
    <Link
      href={row.href}
      aria-label={queueWorkCardLabel({
        borrowerName: row.borrowerName,
        title: body.workItem,
        reason: body.reason ?? "",
        actionLabel: row.actionLabel,
        ownerName: owner,
      })}
      className={`flex items-center gap-4 border-l-2 px-3 py-2 transition hover:bg-stone/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-teal/40 ${QUEUE_ACCENT_EDGE[accent]}`}
    >
      <span aria-hidden className="contents">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="truncate text-[13px] font-semibold tracking-[0.01em] text-ink">
              {row.borrowerName}
            </span>
            {context ? (
              <span className="truncate text-[11px] text-ink-muted">{context}</span>
            ) : null}
          </span>
          <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            <span className="truncate text-[13px] text-ink">{body.workItem}</span>
            {body.reason ? (
              <span
                className={`truncate text-[11px] ${
                  row.hot ? "text-warning" : "text-ink-muted"
                }`}
              >
                {body.reason}
              </span>
            ) : null}
          </span>
        </span>
        <span className="hidden min-w-24 shrink-0 truncate text-[11px] text-ink-muted sm:block">
          {owner ?? "Unassigned"}
        </span>
        {due ? (
          <span className="hidden shrink-0 text-[11px] tabular-nums text-ink-muted md:block">
            {due}
          </span>
        ) : null}
        <span className={workActionChipClass(row.actionLabel)}>
          {row.actionLabel} →
        </span>
      </span>
    </Link>
  );
}
