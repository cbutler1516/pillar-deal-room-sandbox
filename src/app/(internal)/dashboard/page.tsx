import Link from "next/link";
import { NextActionsQueue } from "@/components/next-actions-queue";
import { StatusChip } from "@/components/status-chip";
import { MetricCard } from "@/components/ui/metric-card";
import { StaffPresence } from "@/components/ui/staff-avatar";
import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import { linkClass, pageLeadClass, pageTitleClass, pageWidthClass } from "@/components/ui/styles";
import { requireInternalUser } from "@/lib/auth/session";
import { listActiveStaff } from "@/lib/communications/data";
import { getOperationalBoard } from "@/lib/data/dashboard";
import { staffDisplayName } from "@/lib/data/deals";
import {
  firstNameFromProfile,
  formatLongDate,
  greetingForNow,
} from "@/lib/ops/ops-board";
import { workQueueRow } from "@/lib/ops/queue-today";
import { waitingCopyForDeal, workItemMatchesFilter } from "@/lib/ops/operational-work";
import { formatDashboardSummary } from "@/lib/ui/dashboard-summary";
import { formatProperty } from "@/lib/format";

export default async function DashboardPage() {
  const { supabase, profile } = await requireInternalUser();
  const now = new Date();
  const [{ snapshot, items, counts }, staff] = await Promise.all([
    getOperationalBoard(supabase, now),
    listActiveStaff(supabase),
  ]);
  const staffNames = Object.fromEntries(
    staff.map((person) => [person.id, staffDisplayName(person)]),
  );
  const attentionRows = items.filter((row) => workItemMatchesFilter(row, "attention"));
  const waitingRows = items.filter((row) => row.queueSection === "waiting").slice(0, 6);
  const readyDeals = snapshot.deals
    .filter((deal) => counts.readyDealIds.includes(deal.id))
    .slice(0, 6);
  const firstName = firstNameFromProfile(profile);
  const summary = formatDashboardSummary(counts);
  const waitingCopy = waitingCopyForDeal(items);
  const locationByDeal = Object.fromEntries(
    snapshot.deals.map((deal) => [
      deal.id,
      formatProperty(deal.propertyCity, deal.propertyState),
    ]),
  );

  return (
    <div className={`${pageWidthClass} space-y-8`}>
      <div>
        <p className="text-[11px] text-ink-muted">{formatLongDate(now)}</p>
        <h2 className={`mt-1 ${pageTitleClass}`}>
          {greetingForNow(now)}, {firstName}
        </h2>
        <div className={`${pageLeadClass} space-y-0.5`}>
          <p>{summary.attention}</p>
          <p>{summary.review}</p>
          <p>{summary.ready}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Needs attention"
          value={counts.needsAttention}
          href="/processor-queue?work=attention"
          accent="attention"
        />
        <MetricCard
          label="Waiting"
          value={counts.waiting}
          href="/processor-queue?work=waiting"
          accent="waiting"
        />
        <MetricCard
          label="Docs to review"
          value={counts.docsToReview}
          href="/processor-queue?work=review"
          accent="review"
        />
        <MetricCard
          label="Ready"
          value={counts.ready}
          href="/processor-queue?work=ready"
          accent="ready"
        />
      </div>

      <NextActionsQueue
        rows={attentionRows.slice(0, 7).map((row) =>
          workQueueRow(row, { location: locationByDeal[row.dealId] }),
        )}
        staffNames={staffNames}
        title="Needs attention"
        description="Highest-priority work. Open a row to work it."
        empty="You’re clear for now."
        compact
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard tone="elevated">
          <CardHeader title="Waiting on others" />
          {waitingRows.length === 0 ? (
            <p className="text-sm text-ink-muted">{waitingCopy.empty}</p>
          ) : (
            <ul>
              {waitingRows.map((row) => (
                <li key={row.id} className="border-t border-line py-3 first:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={row.href} className={linkClass}>
                        {row.borrowerName}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        {row.reason}
                        {` · ${row.title}`}
                      </p>
                    </div>
                    <StaffPresence
                      name={
                        row.assignedProcessorId
                          ? staffNames[row.assignedProcessorId]
                          : null
                      }
                      unassigned={!row.assignedProcessorId}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard tone="elevated">
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
                  className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-0"
                >
                  <div className="min-w-0">
                    <Link href={`/deals/${deal.id}`} className={linkClass}>
                      {deal.borrowerName}
                    </Link>
                    <p className="text-xs text-ink-muted">
                      {deal.loanType ?? deal.dealReference}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StaffPresence
                      name={
                        deal.assignedProcessorId
                          ? staffNames[deal.assignedProcessorId]
                          : null
                      }
                      unassigned={!deal.assignedProcessorId}
                    />
                    <StatusChip status={deal.status} label="Ready" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
