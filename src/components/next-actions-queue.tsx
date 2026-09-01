import Link from "next/link";
import { StaffPresence } from "@/components/ui/staff-avatar";
import { CardHeader } from "@/components/ui/surface-card";
import { surfaceClass } from "@/components/ui/styles";
import { formatFollowUpAt } from "@/lib/format";
import {
  QUEUE_ACCENT_EDGE,
  QUEUE_SECTION_WASH,
  queueCardAccent,
  queueCardBody,
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
  layout = "list",
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
  const tone = accent ?? (rows[0] ? queueCardAccent(rows[0].queueSection) : undefined);
  return (
    <section>
      <div className={tone ? `-mx-1 mb-1 rounded-[10px] px-2 pt-1.5 ${QUEUE_SECTION_WASH[tone]}` : ""}>
      <CardHeader
        title={title}
        description={description}
        meta={rows.length}
        accent={tone}
        compact={compact}
      />
      </div>
      {rows.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-line bg-surface-muted/50 px-3 py-5 text-sm leading-6 text-ink-muted">
          {empty}
        </p>
      ) : (
        <ul
          className={
            layout === "grid"
              ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
              : compact
                ? "space-y-2"
                : "space-y-2.5"
          }
        >
          {rows.map((row) => {
            const owner = row.assignedProcessorId
              ? staffNames[row.assignedProcessorId] ?? null
              : null;
            return (
              <li key={row.id} className={layout === "grid" ? "min-w-0" : undefined}>
                <WorkCard row={row} owner={owner} tall={layout === "grid"} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function WorkCard({
  row,
  owner,
  tall,
}: {
  row: QueueDisplayRow;
  owner: string | null;
  tall: boolean;
}) {
  const accent = queueCardAccent(row.queueSection);
  const context =
    queueContextLine({
      loanType: row.loanType,
      location: row.location,
    }) ??
    (row.entityName &&
    row.entityName.trim() &&
    row.entityName !== row.borrowerName
      ? row.entityName
      : null);
  const due =
    row.dueAt && !row.reason.toLowerCase().includes("due")
      ? formatFollowUpAt(row.dueAt)
      : null;
  const rawReason = `${row.reason}${due ? ` · ${due}` : ""}`;
  const body = queueCardBody({
    title: row.title,
    reason: rawReason,
    loanType: row.loanType,
    queueSection: row.queueSection,
    assigned: Boolean(owner),
    actionLabel: row.actionLabel,
  });
  const reason = body.reason;

  return (
    <article className={tall ? "h-full" : undefined}>
      <Link
        href={row.href}
        aria-label={queueWorkCardLabel({
          borrowerName: row.borrowerName,
          title: body.workItem,
          reason: reason ?? "",
          actionLabel: row.actionLabel,
          ownerName: owner,
        })}
        className={`${surfaceClass("elevated", true)} block h-full border-l-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-teal/35 ${QUEUE_ACCENT_EDGE[accent]} px-3.5 py-3`}
      >
        <div aria-hidden className={`flex h-full flex-col ${tall ? "min-h-[6.75rem]" : ""}`}>
          <p className="truncate text-[13px] font-semibold leading-4 tracking-[0.04em] text-ink uppercase">
            {row.borrowerName}
          </p>
          {context ? (
            <p className="mt-0.5 truncate text-xs leading-4 text-ink-muted">{context}</p>
          ) : null}
          <p className="mt-2 text-sm leading-5 text-ink">{body.workItem}</p>
          {reason ? (
            <p
              className={`mt-0.5 text-xs leading-4 ${
                row.hot ? "text-warning" : "text-ink-muted"
              }`}
            >
              {reason}
            </p>
          ) : null}
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-line/80 pt-2.5">
            <StaffPresence name={owner} unassigned={!owner} size={28} />
            <span className="shrink-0 text-xs font-medium leading-4 text-pillar-teal">
              {row.actionLabel} →
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
