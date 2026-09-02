import Link from "next/link";
import { StaffAvatar, StaffPresence } from "@/components/ui/staff-avatar";
import { CardHeader } from "@/components/ui/surface-card";
import { surfaceClass } from "@/components/ui/styles";
import { formatFollowUpAt } from "@/lib/format";
import {
  QUEUE_ACCENT_EDGE,
  QUEUE_FOOTER_TINT,
  QUEUE_SECTION_WASH,
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
      <div
        className={
          tone
            ? `mb-2 border-b border-line px-0 py-1.5 ${QUEUE_SECTION_WASH[tone]}`
            : "mb-2 border-b border-line py-1.5"
        }
      >
      <CardHeader
        title={title}
        description={description}
        meta={rows.length}
        accent={tone}
        compact={compact}
      />
      </div>
      {rows.length === 0 ? (
        <p className="border border-dashed border-line bg-stone/50 px-3 py-5 text-sm leading-6 text-ink-muted">
          {empty}
        </p>
      ) : (
        <ul
          className={
            layout === "grid"
              ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
              : "divide-y divide-line border-y border-line"
          }
        >
          {rows.map((row) => {
            const owner = row.assignedProcessorId
              ? staffNames[row.assignedProcessorId] ?? null
              : null;
            return (
              <li key={row.id} className={layout === "grid" ? "min-w-0" : undefined}>
                {layout === "grid" ? (
                  <WorkCard row={row} owner={owner} tall />
                ) : (
                  <WorkRow row={row} owner={owner} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Dense ledger row — default Queue presentation. */
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
      className={`flex items-center gap-3 border-l-2 px-3 py-2.5 transition hover:bg-stone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-teal/40 ${QUEUE_ACCENT_EDGE[accent]}`}
    >
      <span aria-hidden className="contents">
        <StaffAvatar name={owner} unassigned={!owner} size={28} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="truncate text-[13px] font-semibold tracking-[0.02em] text-ink uppercase">
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
        <span className={workActionChipClass(row.actionLabel)}>
          {row.actionLabel} →
        </span>
      </span>
    </Link>
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
        className={`${surfaceClass("card", true)} block h-full overflow-hidden border-l-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-teal/40 ${QUEUE_ACCENT_EDGE[accent]} px-3.5 pt-3 pb-0`}
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
          <div
            className={`-mx-3.5 mt-auto flex items-center justify-between gap-3 border-t border-line/70 px-3.5 py-2 ${QUEUE_FOOTER_TINT[accent]}`}
          >
            <StaffPresence name={owner} unassigned={!owner} size={28} />
            <span className={workActionChipClass(row.actionLabel)}>
              {row.actionLabel} →
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
