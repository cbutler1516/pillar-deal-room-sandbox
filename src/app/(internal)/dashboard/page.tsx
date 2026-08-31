import Link from "next/link";
import { NextActionsQueue } from "@/components/next-actions-queue";
import { StatusChip } from "@/components/status-chip";
import { MetricCard } from "@/components/ui/metric-card";
import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import { linkClass, pageLeadClass, pageTitleClass, pageWidthClass } from "@/components/ui/styles";
import { requireInternalUser } from "@/lib/auth/session";
import { getOperationalBoard } from "@/lib/data/dashboard";
import {
  firstNameFromProfile,
  formatLongDate,
  greetingForHour,
} from "@/lib/ops/ops-board";
import { staffHour } from "@/lib/format";
import { workQueueRow } from "@/lib/ops/queue-today";
import { waitingCopyForDeal, workItemMatchesFilter } from "@/lib/ops/operational-work";

export default async function DashboardPage() {
  const { supabase, profile } = await requireInternalUser();
  const now = new Date();
  const { snapshot, items, counts } = await getOperationalBoard(supabase, now);
  const attentionRows = items.filter((row) => workItemMatchesFilter(row, "attention"));
  const waitingRows = items.filter((row) => row.queueSection === "waiting").slice(0, 6);
  const readyDeals = snapshot.deals
    .filter((deal) => counts.readyDealIds.includes(deal.id))
    .slice(0, 6);
  const firstName = firstNameFromProfile(profile);
  const fileWord = counts.needsAttention === 1 ? "file" : "files";
  const waitingCopy = waitingCopyForDeal(items);

  return (
    <div className={`${pageWidthClass} space-y-8`}>
      <div>
        <p className="text-[11px] text-ink-muted">{formatLongDate(now)}</p>
        <h2 className={`mt-1 ${pageTitleClass}`}>
          {greetingForHour(staffHour(now))}, {firstName}
        </h2>
        <p className={pageLeadClass}>
          {counts.needsAttention === 0
            ? "Nothing needs your attention right now."
            : `${counts.needsAttention} ${fileWord} need your attention today.`}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Needs attention"
          value={counts.needsAttention}
          href="/processor-queue?work=attention"
        />
        <MetricCard
          label="Waiting"
          value={counts.waiting}
          href="/processor-queue?work=waiting"
        />
        <MetricCard
          label="Docs to review"
          value={counts.docsToReview}
          href="/processor-queue?work=review"
        />
        <MetricCard
          label="Ready"
          value={counts.ready}
          href="/processor-queue?work=ready"
        />
      </div>

      <NextActionsQueue
        rows={attentionRows.slice(0, 7).map(workQueueRow)}
        title="Needs attention"
        description="Highest-priority work. Open a row to work it."
        empty="You’re clear for now."
        compact
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard>
          <CardHeader title="Waiting on others" />
          {waitingRows.length === 0 ? (
            <p className="text-sm text-ink-muted">{waitingCopy.empty}</p>
          ) : (
            <ul>
              {waitingRows.map((row) => (
                <li key={row.id} className="border-t border-line py-2.5 first:border-0">
                  <Link href={row.href} className={linkClass}>
                    {row.borrowerName}
                  </Link>
                  <p className="text-xs text-ink-muted">
                    {row.reason}
                    {` · ${row.title}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <CardHeader title="Ready for submission" />
          {readyDeals.length === 0 ? (
            <p className="text-sm leading-6 text-ink-muted">
              No files are ready to submit.
            </p>
          ) : (
            <ul>
              {readyDeals.map((deal) => (
                <li
                  key={deal.id}
                  className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-0"
                >
                  <div>
                    <Link href={`/deals/${deal.id}`} className={linkClass}>
                      {deal.borrowerName}
                    </Link>
                    <p className="text-xs text-ink-muted">
                      {deal.loanType ?? deal.dealReference}
                    </p>
                  </div>
                  <StatusChip status={deal.status} label="Ready" />
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
