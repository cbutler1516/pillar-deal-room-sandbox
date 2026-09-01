import Link from "next/link";
import { NextActionsQueue } from "@/components/next-actions-queue";
import { StatusChip } from "@/components/status-chip";
import { MetricCard } from "@/components/ui/metric-card";
import { StaffAvatar, StaffPresence } from "@/components/ui/staff-avatar";
import { displayName } from "@/lib/auth/authorization";
import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import { linkClass, pageWidthClass } from "@/components/ui/styles";
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
import { isLenderCondition } from "@/lib/conditions/model";
import { formatDashboardSummary } from "@/lib/ui/dashboard-summary";
import { humanizeWorkReason } from "@/lib/ui/staff-copy";
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
  const openConditions = snapshot.tasks.filter(
    (task) =>
      isLenderCondition(task) &&
      task.status !== "completed" &&
      task.status !== "dismissed",
  ).length;
  const locationByDeal = Object.fromEntries(
    snapshot.deals.map((deal) => [
      deal.id,
      formatProperty(deal.propertyCity, deal.propertyState),
    ]),
  );

  return (
    <div className={`${pageWidthClass} space-y-5`}>
      <div className="rounded-[16px] border border-pillar-navy/15 bg-[linear-gradient(115deg,rgb(11_31_58/0.1)_0%,var(--pillar-teal-soft)_36%,#ffffff_70%,var(--info-soft)_100%)] px-4 py-3 shadow-[var(--shadow-elevated)]">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-3.5">
            <StaffAvatar name={displayName(profile)} size={48} />
            <div className="min-w-0">
              <p className="text-[11px] leading-4 text-ink-muted">{formatLongDate(now)}</p>
              <h2 className="mt-0.5 text-lg font-semibold leading-6 tracking-tight text-ink">
                {greetingForNow(now)}, {firstName}
              </h2>
            </div>
          </div>
          <p className="max-w-xl text-sm leading-5 text-ink-muted">{summary.line}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Files needing attention"
          value={counts.needsAttention}
          href="/processor-queue?work=attention"
          accent="attention"
        />
        <MetricCard
          label="Waiting on others"
          value={counts.waiting}
          href="/processor-queue?work=waiting"
          accent="waiting"
        />
        <MetricCard
          label="Documents to review"
          value={counts.docsToReview}
          href="/processor-queue?work=review"
          accent="review"
        />
        <MetricCard
          label="Ready to submit"
          value={counts.ready}
          href="/processor-queue?work=ready"
          accent="ready"
        />
      </div>
      {openConditions > 0 ? (
        <p className="text-xs text-ink-muted">
          {openConditions} open condition{openConditions === 1 ? "" : "s"} are
          included in operational work.{" "}
          <Link href="/processor-queue" className={linkClass}>
            Open Queue
          </Link>
        </p>
      ) : null}

      <NextActionsQueue
        rows={attentionRows.slice(0, 10).map((row) =>
          workQueueRow(row, { location: locationByDeal[row.dealId] }),
        )}
        staffNames={staffNames}
        title="Files needing attention"
        description="Highest-priority work"
        empty="You’re clear for now."
        compact
        layout="grid"
        accent="urgent"
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <SurfaceCard tone="elevated">
          <CardHeader title="Waiting on others" />
          {waitingRows.length === 0 ? (
            <p className="text-sm text-ink-muted">{waitingCopy.empty}</p>
          ) : (
            <ul>
              {waitingRows.map((row) => (
                <li key={row.id} className="border-t border-line py-2 first:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={row.href} className={linkClass}>
                        {row.borrowerName}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        {humanizeWorkReason(row.reason)}
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
                  className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-0"
                >
                  <div className="min-w-0">
                    <Link href={`/deals/${deal.id}?tab=submission`} className={linkClass}>
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
                    <StatusChip status={deal.status} label="Ready to submit" />
                    <Link
                      href={`/deals/${deal.id}?tab=submission`}
                      className={`${linkClass} text-xs`}
                    >
                      Prepare submission
                    </Link>
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
